/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("node:child_process");

const ports = (process.env.DEV_PORTS || "3000,3001")
  .split(",")
  .map((port) => Number(port.trim()))
  .filter((port) => Number.isInteger(port) && port > 0);

function run(command) {
  return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function killWindowsPorts() {
  const output = run("netstat -ano -p tcp");
  const listeners = [];

  for (const line of output.split(/\r?\n/)) {
    if (!/\bLISTENING\b/i.test(line)) continue;
    const parts = line.trim().split(/\s+/);
    const localAddress = parts[1] || "";
    const pid = parts[parts.length - 1];
    const port = ports.find((candidate) => localAddress.endsWith(`:${candidate}`));
    if (port && /^\d+$/.test(pid)) {
      listeners.push({ pid, port });
    }
  }

  const projectRoot = process.cwd().toLowerCase();
  const targets = new Set();

  function readProcess(pid) {
    try {
      const json = run(
        `powershell -NoProfile -Command "$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}'; if ($p) { $p | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress }"`,
      ).trim();
      return json ? JSON.parse(json) : null;
    } catch {
      return null;
    }
  }

  function isDockerProcess(processInfo) {
    const commandLine = String(processInfo.CommandLine || "").toLowerCase();
    const name = String(processInfo.Name || "").toLowerCase();
    return (
      name.includes("docker") ||
      commandLine.includes("docker") ||
      commandLine.includes("com.docker") ||
      commandLine.includes("containerd")
    );
  }

  function describeProcess(processInfo) {
    return processInfo?.Name || processInfo?.CommandLine || "unknown process";
  }

  for (const listener of listeners) {
    let currentPid = listener.pid;
    let projectOwned = false;
    let dockerOwned = false;
    let ownerInfo = null;

    for (let depth = 0; depth < 4 && currentPid; depth += 1) {
      const processInfo = readProcess(currentPid);
      if (!processInfo) break;
      ownerInfo ||= processInfo;
      if (isDockerProcess(processInfo)) {
        dockerOwned = true;
        break;
      }
      const commandLine = String(processInfo.CommandLine || "").toLowerCase();
      if (commandLine.includes(projectRoot)) {
        projectOwned = true;
        break;
      }
      currentPid = String(processInfo.ParentProcessId || "");
    }

    if (projectOwned) {
      targets.add(listener.pid);
    } else {
      const owner = dockerOwned ? "Docker" : describeProcess(ownerInfo);
      console.warn(
        `Port ${listener.port} is in use by ${owner} (PID ${listener.pid}); leaving it running.`,
      );
    }
  }

  const processPatterns = [];
  if (ports.includes(3000) && ports.includes(3001)) {
    processPatterns.push("nodemon src/server.js", "npm.cmd run dev:backend", "npm run dev:backend");
    processPatterns.push("next dev", "npm.cmd run dev:frontend", "npm run dev:frontend");
    processPatterns.push("next start", "start-server.js", "npm.cmd run start", "npm run start");
    processPatterns.push("concurrently", "npm.cmd run dev", "npm run dev");
  }

  if (processPatterns.length > 0) {
    try {
      const patternExpression = processPatterns
        .map((pattern) => "$_.CommandLine.ToLower().Contains('" + pattern.replace(/'/g, "''") + "')")
        .join(" -or ");
      const json = run(
        "powershell -NoProfile -Command \"Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.ToLower().Contains('" +
          projectRoot.replace(/'/g, "''") +
          "') -and (" +
          patternExpression +
          ") } | Select-Object ProcessId | ConvertTo-Json -Compress\"",
      ).trim();
      const projectProcesses = json ? JSON.parse(json) : [];
      const rows = Array.isArray(projectProcesses) ? projectProcesses : [projectProcesses];
      for (const row of rows) {
        if (row?.ProcessId) targets.add(String(row.ProcessId));
      }
    } catch {
      // Best effort; port listeners above are still handled.
    }
  }

  for (const pid of targets) {
    if (Number(pid) === process.pid || Number(pid) === process.ppid) continue;
    try {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
      console.log(`Freed dev port process ${pid}`);
    } catch {
      // The process may have already exited.
    }
  }
}

function killUnixPorts() {
  const projectRoot = process.cwd();

  function readProcess(pid) {
    try {
      const output = run(`ps -p ${pid} -o pid= -o ppid= -o command=`);
      const match = output.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
      if (!match) return null;
      return { pid: match[1], parentPid: match[2], commandLine: match[3] };
    } catch {
      return null;
    }
  }

  function isProjectProcess(pid) {
    let currentPid = pid;
    for (let depth = 0; depth < 4 && currentPid; depth += 1) {
      const processInfo = readProcess(currentPid);
      if (!processInfo) break;
      if (processInfo.commandLine.includes(projectRoot)) return true;
      if (/\b(docker|containerd)\b/i.test(processInfo.commandLine)) return false;
      currentPid = processInfo.parentPid;
    }
    return false;
  }

  for (const port of ports) {
    try {
      const pids = run(`lsof -ti tcp:${port}`).split(/\r?\n/).filter(Boolean);
      for (const pid of pids) {
        if (Number(pid) === process.pid) continue;
        if (!isProjectProcess(pid)) {
          console.warn(`Port ${port} is in use by PID ${pid}; leaving it running.`);
          continue;
        }
        try {
          process.kill(Number(pid), "SIGTERM");
          console.log(`Freed dev port ${port} process ${pid}`);
        } catch {
          // The process may have already exited.
        }
      }
    } catch {
      // lsof may not exist or the port may be free.
    }
  }
}

if (process.platform === "win32") {
  killWindowsPorts();
} else {
  killUnixPorts();
}
