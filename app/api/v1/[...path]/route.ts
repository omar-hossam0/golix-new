import * as http from "node:http";
import * as https from "node:https";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { NextRequest } from "next/server";

type ApiRouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

type ProxyGlobals = typeof globalThis & {
  goalixHttpAgents?: http.Agent[];
  goalixHttpsAgents?: https.Agent[];
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "expect",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const MAX_UPSTREAM_SOCKETS = Math.max(
  16,
  Number(process.env.GOALIX_API_PROXY_MAX_SOCKETS || 1024),
);
const MAX_FREE_UPSTREAM_SOCKETS = Math.max(
  8,
  Math.min(
    MAX_UPSTREAM_SOCKETS,
    Number(process.env.GOALIX_API_PROXY_MAX_FREE_SOCKETS || 128),
  ),
);
const UPSTREAM_TIMEOUT_MS = Math.max(
  5_000,
  Number(process.env.GOALIX_API_PROXY_TIMEOUT_MS || 90_000),
);
const UPSTREAM_LOCAL_ADDRESSES = (
  process.env.GOALIX_API_PROXY_LOCAL_ADDRESSES || ""
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const AGENT_LOCAL_ADDRESSES =
  UPSTREAM_LOCAL_ADDRESSES.length > 0
    ? UPSTREAM_LOCAL_ADDRESSES
    : [undefined];
const SOCKETS_PER_AGENT = Math.max(
  16,
  Math.ceil(MAX_UPSTREAM_SOCKETS / AGENT_LOCAL_ADDRESSES.length),
);
const FREE_SOCKETS_PER_AGENT = Math.max(
  8,
  Math.ceil(MAX_FREE_UPSTREAM_SOCKETS / AGENT_LOCAL_ADDRESSES.length),
);

const proxyGlobals = globalThis as ProxyGlobals;

function createAgentOptions(localAddress?: string) {
  return {
    keepAlive: true,
    keepAliveMsecs: 1_000,
    maxSockets: SOCKETS_PER_AGENT,
    maxTotalSockets: SOCKETS_PER_AGENT,
    maxFreeSockets: Math.min(SOCKETS_PER_AGENT, FREE_SOCKETS_PER_AGENT),
    ...(localAddress ? { localAddress } : {}),
    scheduling: "fifo" as const,
  };
}

const httpAgents =
  proxyGlobals.goalixHttpAgents ??
  AGENT_LOCAL_ADDRESSES.map((localAddress) =>
    new http.Agent(createAgentOptions(localAddress)),
  );
const httpsAgents =
  proxyGlobals.goalixHttpsAgents ??
  AGENT_LOCAL_ADDRESSES.map((localAddress) =>
    new https.Agent(createAgentOptions(localAddress)),
  );

proxyGlobals.goalixHttpAgents = httpAgents;
proxyGlobals.goalixHttpsAgents = httpsAgents;

let upstreamAgentCursor = 0;

function pickAgent(agents: http.Agent[] | https.Agent[]) {
  const agent = agents[upstreamAgentCursor % agents.length];
  upstreamAgentCursor =
    (upstreamAgentCursor + 1) % Number.MAX_SAFE_INTEGER;
  return agent;
}

function getApiUrl() {
  return (
    process.env.GOALIX_INTERNAL_API_URL ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
}

function copyRequestHeaders(
  request: NextRequest,
  target: URL,
): http.OutgoingHttpHeaders {
  const headers: http.OutgoingHttpHeaders = {};
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers[key] = value;
    }
  });

  headers.host = target.host;
  headers["x-forwarded-host"] = request.headers.get("host") || "";
  headers["x-forwarded-proto"] = request.nextUrl.protocol.replace(":", "");
  const existingForwardedFor = request.headers.get("x-forwarded-for");
  const requestIp =
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    (request as unknown as { ip?: string }).ip;
  if (existingForwardedFor && requestIp) {
    headers["x-forwarded-for"] = `${existingForwardedFor}, ${requestIp}`;
  } else if (existingForwardedFor || requestIp) {
    headers["x-forwarded-for"] = existingForwardedFor || requestIp;
  }
  return headers;
}

function copyResponseHeaders(upstream: http.IncomingMessage) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(upstream.headers)) {
    if (
      value === undefined ||
      HOP_BY_HOP_HEADERS.has(key.toLowerCase())
    ) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
    } else {
      headers.set(key, String(value));
    }
  }

  return headers;
}

function requestUpstream(
  target: URL,
  request: NextRequest,
  body: ReadableStream<Uint8Array> | null | undefined,
) {
  const transport = target.protocol === "https:" ? https : http;
  const agent =
    target.protocol === "https:"
      ? pickAgent(httpsAgents)
      : pickAgent(httpAgents);

  return new Promise<Response>((resolve, reject) => {
    const upstreamRequest = transport.request(
      target,
      {
        method: request.method,
        headers: copyRequestHeaders(request, target),
        agent,
      },
      (upstreamResponse) => {
        const responseBody =
          request.method === "HEAD"
            ? null
            : (Readable.toWeb(
                upstreamResponse,
              ) as ReadableStream<Uint8Array>);

        resolve(
          new Response(responseBody, {
            status: upstreamResponse.statusCode || 502,
            statusText: upstreamResponse.statusMessage,
            headers: copyResponseHeaders(upstreamResponse),
          }),
        );
      },
    );

    upstreamRequest.setTimeout(UPSTREAM_TIMEOUT_MS, () => {
      upstreamRequest.destroy(
        new Error(`Goalix upstream timed out after ${UPSTREAM_TIMEOUT_MS}ms`),
      );
    });
    upstreamRequest.once("error", reject);

    if (body) {
      const readableBody = Readable.fromWeb(
        body as unknown as NodeReadableStream<Uint8Array>,
      );
      readableBody.once("error", (streamError) => {
        upstreamRequest.destroy(streamError);
      });
      readableBody.pipe(upstreamRequest);
    } else {
      upstreamRequest.end();
    }
  });
}

let proxyFailureCount = 0;

async function proxyApiRequest(
  request: NextRequest,
  context: ApiRouteContext,
) {
  const params = await context.params;
  const fallbackPath = request.nextUrl.pathname
    .replace(/^\/api\/v1\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  const path = params.path?.length ? params.path : fallbackPath;
  const target = new URL(
    `/api/v1/${path.join("/")}${request.nextUrl.search}`,
    getApiUrl(),
  );
  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  try {
    return await requestUpstream(
      target,
      request,
      hasBody ? request.body : undefined,
    );
  } catch (error) {
    proxyFailureCount += 1;
    if (proxyFailureCount === 1 || proxyFailureCount % 100 === 0) {
      console.error("Goalix API proxy connection failed", {
        target: target.origin,
        method,
        failures: proxyFailureCount,
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    return Response.json(
      {
        success: false,
        error: {
          code: "BACKEND_UNAVAILABLE",
          message:
            "The Goalix server is restarting or temporarily unavailable. Please try again.",
          details: [],
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
          "retry-after": "2",
        },
      },
    );
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = proxyApiRequest;
export const HEAD = proxyApiRequest;
export const POST = proxyApiRequest;
export const PUT = proxyApiRequest;
export const PATCH = proxyApiRequest;
export const DELETE = proxyApiRequest;
export const OPTIONS = proxyApiRequest;
