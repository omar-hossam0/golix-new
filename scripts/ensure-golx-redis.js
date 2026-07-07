/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync } = require("node:child_process");
const net = require("node:net");

const containerName = process.env.GOLX_REDIS_CONTAINER || "golx-redis";
const image = process.env.GOLX_REDIS_IMAGE || "redis:7-alpine";
const hostPort = process.env.GOLX_REDIS_PORT || "6379";
const dataVolume = process.env.GOLX_REDIS_VOLUME || "golx-redis-data";
const optional = process.env.GOALIX_REDIS_OPTIONAL === "true";

function docker(args, options = {}) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: Number(port) });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForRedis() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const output = docker(["exec", containerName, "redis-cli", "ping"]).trim();
      if (output === "PONG") return;
    } catch {
      // Redis can take a short moment to accept commands after container start.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${containerName} started but did not answer redis-cli ping`);
}

async function main() {
  try {
    docker(["info"]);
  } catch {
    if (await isPortOpen(hostPort)) {
      console.warn(`Docker is not available, but Redis port ${hostPort} is open; continuing.`);
      return;
    }
    const message = `Docker is not available and Redis port ${hostPort} is closed.`;
    if (optional) {
      console.warn(`${message} Redis cache/queue features are disabled, but dev will continue.`);
      return;
    }
    console.error(`${message} Start Docker Desktop or Redis, then run npm run dev again.`);
    process.exit(1);
  }

  let exists = true;
  let running = false;
  try {
    running = docker(["inspect", "--format", "{{.State.Running}}", containerName]).trim() === "true";
  } catch {
    exists = false;
  }

  if (!exists) {
    docker([
      "run",
      "-d",
      "--name",
      containerName,
      "-p",
      `${hostPort}:6379`,
      "--restart",
      "unless-stopped",
      "-v",
      `${dataVolume}:/data`,
      image,
    ]);
    console.log(`Started Redis container ${containerName} on port ${hostPort}.`);
  } else if (!running) {
    docker(["start", containerName]);
    console.log(`Started Redis container ${containerName}.`);
  } else {
    console.log(`Redis container ${containerName} is already running.`);
  }

  await waitForRedis();
}

main().catch((error) => {
  if (optional) {
    console.warn(`Redis cache/queue features are disabled, but dev will continue: ${error.message}`);
    return;
  }
  console.error(error.message);
  process.exit(1);
});
