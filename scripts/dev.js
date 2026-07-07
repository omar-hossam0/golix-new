/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync, spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const backendDir = path.join(rootDir, "golx-backend");
const nodemonBin = path.join(backendDir, "node_modules", "nodemon", "bin", "nodemon.js");
const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
const useHttps = process.argv.includes("--https");

function runNodeScript(fileName, env = {}) {
  execFileSync(process.execPath, [path.join(__dirname, fileName)], {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

function isGoalixApiRunning() {
  return new Promise((resolve) => {
    const body = JSON.stringify({ email: "goalix-dev-probe@example.com", password: "invalid" });
    const request = http.request(
      "http://127.0.0.1:3000/api/v1/auth/admin/login",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (response) => {
        response.resume();
        response.on("end", () => {
          resolve([400, 401, 429].includes(response.statusCode || 0));
        });
      },
    );

    request.on("error", () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
    request.end(body);
  });
}

function isAnyHttpServerRunningOnBackendPort() {
  return new Promise((resolve) => {
    const request = http.get("http://127.0.0.1:3000/health", (response) => {
      response.resume();
      response.on("end", () => {
        resolve(true);
      });
    });

    request.on("error", () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function pipeWithLabel(stream, label, target) {
  stream.on("data", (chunk) => {
    const text = chunk.toString();
    for (const line of text.split(/\r?\n/)) {
      if (line) target.write(`[${label}] ${line}\n`);
    }
  });
}

function spawnLabeled(command, args, { cwd = rootDir, label, env = {} }) {
  const child = spawn(command, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });

  pipeWithLabel(child.stdout, label, process.stdout);
  pipeWithLabel(child.stderr, label, process.stderr);
  return child;
}

function stopChild(child) {
  if (!child.pid || child.killed) return;

  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      return;
    } catch {
      // Fall through to child.kill.
    }
  }

  child.kill();
}

function frontendArgs() {
  return [
    nextBin,
    "dev",
    ...(useHttps ? ["--experimental-https"] : []),
    "-H",
    "0.0.0.0",
    "-p",
    "3001",
  ];
}

function frontendEnv() {
  return {
    GOALIX_INTERNAL_API_URL: "http://127.0.0.1:3000",
    NEXT_PUBLIC_API_URL: "",
  };
}

function keepDevProcessAlive() {
  return new Promise(() => {});
}

async function runFrontendOnly() {
  const child = spawnLabeled(process.execPath, frontendArgs(), {
    label: "frontend",
    env: frontendEnv(),
  });
  child.on("exit", (code) => process.exit(code || 0));
  await keepDevProcessAlive();
}

function waitForBackendHealth({ timeoutMs = 45000, intervalMs = 500 } = {}) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get("http://127.0.0.1:3000/health", (response) => {
        response.resume();
        response.on("end", () => {
          if (response.statusCode === 200) {
            resolve();
            return;
          }
          scheduleNext();
        });
      });

      request.on("error", scheduleNext);
      request.setTimeout(1000, () => {
        request.destroy();
        scheduleNext();
      });
    };

    const scheduleNext = () => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("Goalix API did not become healthy on port 3000 within 45 seconds."));
        return;
      }
      setTimeout(check, intervalMs);
    };

    check();
  });
}

function checkBackendHealth() {
  return new Promise((resolve) => {
    const request = http.get("http://127.0.0.1:3000/health", (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode === 200));
    });

    request.on("error", () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function runManagedDev() {
  const children = [];
  let shuttingDown = false;

  function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) stopChild(child);
    process.exit(code);
  }

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  const backend = spawnLabeled(process.execPath, [nodemonBin, "--exitcrash", "src/server.js"], {
    cwd: backendDir,
    label: "backend",
  });
  children.push(backend);

  backend.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`Backend dev process exited${code === null ? "" : ` with code ${code}`}; stopping frontend too.`);
      shutdown(code || 1);
    }
  });

  await waitForBackendHealth();
  if (shuttingDown) return;

  const frontend = spawnLabeled(process.execPath, frontendArgs(), {
    label: "frontend",
    env: frontendEnv(),
  });
  children.push(frontend);

  let failedHealthChecks = 0;
  const healthInterval = setInterval(async () => {
    if (shuttingDown) return;
    const healthy = await checkBackendHealth();
    if (healthy) {
      failedHealthChecks = 0;
      return;
    }

    failedHealthChecks += 1;
    if (failedHealthChecks >= 3) {
      console.error("Goalix API health check failed repeatedly; stopping frontend to avoid serving broken 503 responses.");
      shutdown(1);
    }
  }, 5000);
  healthInterval.unref?.();

  frontend.on("exit", (code) => {
    if (!shuttingDown) shutdown(code || 0);
  });

  await keepDevProcessAlive();
}

async function main() {
  runNodeScript("ensure-python-models.js");
  runNodeScript("ensure-golx-redis.js", { GOALIX_REDIS_OPTIONAL: "true" });

  const apiAlreadyRunning = await isGoalixApiRunning();
  if (apiAlreadyRunning) {
    runNodeScript("free-dev-ports.js", { DEV_PORTS: "3001" });
    const frontendPortAvailable = await isPortAvailable(3001);
    if (!frontendPortAvailable) {
      console.error("Port 3001 is still busy. Close the process using it, then run npm run dev again.");
      process.exit(1);
    }

    console.log("Goalix API is already running on port 3000; starting frontend only.");
    runFrontendOnly();
    return;
  }

  runNodeScript("free-dev-ports.js", { DEV_PORTS: "3000,3001" });

  const frontendPortAvailable = await isPortAvailable(3001);
  if (!frontendPortAvailable) {
    console.error("Port 3001 is still busy. Close the process using it, then run npm run dev again.");
    process.exit(1);
  }

  const backendPortAvailable = await isPortAvailable(3000);
  if (!backendPortAvailable) {
    if (await isAnyHttpServerRunningOnBackendPort()) {
      console.error(
        "Port 3000 is busy, but the server there is not the Goalix API. Stop that container/process, then run npm run dev again.",
      );
      process.exit(1);
    }

    console.error(
      "Port 3000 is busy, but it is not answering as the Goalix API. Close that process/container, then run npm run dev again.",
    );
    process.exit(1);
  }

  await runManagedDev();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
