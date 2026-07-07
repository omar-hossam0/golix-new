import { NextRequest, NextResponse } from "next/server";

type JwtPayload = {
  role?: string;
  exp?: number;
  nbf?: number;
  [key: string]: unknown;
};

function getApiUrl() {
  return (
    process.env.GOALIX_INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
}

function getPublicApiOrigin() {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (!configured) return "";
  try {
    return new URL(configured).origin;
  } catch {
    return "";
  }
}

function securityHeaders(nonce: string, requestHost?: string) {
  const isDev = process.env.NODE_ENV === "development";
  const publicApiOrigin = getPublicApiOrigin();
  const apiWsOrigin = publicApiOrigin
    ? publicApiOrigin.replace(/^http:/, "ws:").replace(/^https:/, "wss:")
    : "";

  const httpConnectSources = [
    publicApiOrigin,
    ...(isDev
      ? [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "http://localhost:3001",
          "http://127.0.0.1:3001",
        ]
      : []),
  ].filter(Boolean);
  const wsConnectSources = [
    apiWsOrigin,
    ...(isDev
      ? [
          "ws://localhost:3000",
          "ws://127.0.0.1:3000",
          "ws://localhost:3001",
          "ws://127.0.0.1:3001",
        ]
      : []),
  ].filter(Boolean);

  if (isDev && requestHost) {
    httpConnectSources.push(
      `http://${requestHost}:3000`,
      `http://${requestHost}:3001`,
    );
    wsConnectSources.push(
      `ws://${requestHost}:3000`,
      `ws://${requestHost}:3001`,
    );
  }

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${[...new Set(httpConnectSources)].join(" ")}`,
    "font-src 'self' data:",
    `connect-src 'self' ${[...new Set([...httpConnectSources, ...wsConnectSources])].join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  const headers: Record<string, string> = {
    "Content-Security-Policy": csp,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Permitted-Cross-Domain-Policies": "none",
  };

  if (!isDev) {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains; preload";
    headers["Content-Security-Policy"] = `${csp}; upgrade-insecure-requests`;
    headers["Permissions-Policy"] =
      "camera=(self), microphone=(), geolocation=()";
  }

  return headers;
}

function getAccessJwtSecret() {
  return process.env.GOALIX_ACCESS_JWT_SECRET || process.env.JWT_SECRET || "";
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function decodeBase64UrlJson(value: string) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}

function isTimeValid(payload: JwtPayload) {
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp <= now) return false;
  if (typeof payload.nbf === "number" && payload.nbf > now) return false;
  return true;
}

function decodeJwtWithoutVerification(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = decodeBase64UrlJson(parts[1]) as JwtPayload;
    return isTimeValid(payload) ? payload : null;
  } catch {
    return null;
  }
}

async function verifyJwt(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerPart, payloadPart, signaturePart] = parts;
    const header = decodeBase64UrlJson(headerPart) as { alg?: string };
    if (header.alg !== "HS256") return null;

    const secret = getAccessJwtSecret();
    if (!secret) {
      return process.env.NODE_ENV === "development"
        ? decodeJwtWithoutVerification(token)
        : null;
    }

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signaturePart),
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    );
    if (!isValid) return null;

    const payload = decodeBase64UrlJson(payloadPart) as JwtPayload;
    return isTimeValid(payload) ? payload : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const pathname = request.nextUrl.pathname;
  const requestHost =
    request.headers.get("host")?.split(":")[0] || request.nextUrl.hostname;
  const headers = securityHeaders(nonce, requestHost);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(
    "Content-Security-Policy",
    headers["Content-Security-Policy"],
  );

  // Server-side Route Protection Check
  const token = request.cookies.get("accessToken")?.value;
  const decoded = token ? await verifyJwt(token) : null;
  const isAuthenticated = !!decoded;
  const role = decoded?.role;

  const isAdminPath = pathname.startsWith("/admin");
  const isCoachPath = pathname.startsWith("/coach");
  const isPlayerPath = pathname.startsWith("/player");
  const isParentPath = pathname.startsWith("/parent");

  // Redirect mappings
  const roleRoutes: Record<string, string> = {
    admin: "/admin/dashboard",
    coach: "/coach/home",
    player: "/player/home",
    parent: "/parent/home",
  };

  if (isAdminPath && pathname !== "/admin-login") {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/admin-login", request.url));
    }
    if (role !== "admin") {
      const dest = role && roleRoutes[role] ? roleRoutes[role] : "/admin-login";
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  if (isCoachPath) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/admin-login", request.url));
    }
    if (role !== "coach") {
      const dest = role && roleRoutes[role] ? roleRoutes[role] : "/admin-login";
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  if (isPlayerPath) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (role !== "player") {
      const dest = role && roleRoutes[role] ? roleRoutes[role] : "/login";
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  if (isParentPath) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (role !== "parent") {
      const dest = role && roleRoutes[role] ? roleRoutes[role] : "/login";
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  const isBackendRequest = pathname.startsWith("/uploads/");

  const response = isBackendRequest
    ? NextResponse.rewrite(
        new URL(`${pathname}${request.nextUrl.search}`, getApiUrl()),
        { request: { headers: requestHeaders } },
      )
    : NextResponse.next({ request: { headers: requestHeaders } });

  Object.entries(headers).forEach(([key, value]) =>
    response.headers.set(key, value),
  );
  return response;
}

export const config = {
  matcher: [
    "/uploads/:path*",
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
