/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const requirementsPath = path.join(rootDir, "Models", "requirements.txt");
const projectPython =
  process.platform === "win32"
    ? path.join(rootDir, ".venv", "Scripts", "python.exe")
    : path.join(rootDir, ".venv", "bin", "python");
const requirePythonModels =
  process.env.GOALIX_REQUIRE_PYTHON_MODELS === "true" ||
  process.env.NODE_ENV === "production";

const probe = [
  "import joblib, pandas, sklearn",
  "assert sklearn.__version__ == '1.7.2', sklearn.__version__",
  "print('Python model dependencies are ready.')",
].join("; ");

function isFilePath(value) {
  return path.isAbsolute(value) || value.includes("/") || value.includes("\\");
}

function pythonCandidates() {
  const configured = process.env.PYTHON_BIN || process.env.PYTHON;
  const candidates = [
    configured && { command: configured, argsPrefix: [] },
    fs.existsSync(projectPython) && { command: projectPython, argsPrefix: [] },
    process.platform === "win32" && { command: "py", argsPrefix: ["-3"] },
    { command: "python3", argsPrefix: [] },
    { command: "python", argsPrefix: [] },
  ].filter(Boolean);

  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = `${candidate.command}\0${candidate.argsPrefix.join(" ")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return !isFilePath(candidate.command) || fs.existsSync(candidate.command);
  });
}

function runPython(candidate, args, stdio = "inherit") {
  return execFileSync(candidate.command, [...candidate.argsPrefix, ...args], {
    cwd: rootDir,
    stdio,
    env: { ...process.env, PYTHONIOENCODING: process.env.PYTHONIOENCODING || "utf-8" },
    windowsHide: true,
  });
}

function findPython() {
  for (const candidate of pythonCandidates()) {
    try {
      runPython(candidate, ["--version"], "ignore");
      return candidate;
    } catch {
      // Try the next executable. Windows Store aliases fail here when Python is not installed.
    }
  }
  return null;
}

function formatPython(candidate) {
  return [candidate.command, ...candidate.argsPrefix].join(" ");
}

const python = findPython();

if (!python) {
  const message =
    "Python was not found, so Goalix Python AI model dependency setup was skipped. " +
    "The app can still run in development, but Ranking/Injury Risk AI endpoints need Python. " +
    "Install Python 3.11+ or set PYTHON_BIN to a valid python.exe, then run: " +
    `"python" -m pip install -r "${requirementsPath}"`;

  if (requirePythonModels) {
    console.error(message);
    process.exit(1);
  }

  console.warn(message);
  process.exit(0);
}

try {
  runPython(python, ["-c", probe]);
} catch {
  console.log("Installing Goalix Python model dependencies...");
  try {
    runPython(python, ["-m", "pip", "install", "-r", requirementsPath]);
    runPython(python, ["-c", probe]);
  } catch (error) {
    const pythonLabel = formatPython(python);
    console.error(
      `Unable to prepare the Goalix Python models with "${pythonLabel}". ` +
        `Set PYTHON_BIN to a valid Python executable, then run: ` +
        `"${pythonLabel}" -m pip install -r "${requirementsPath}"`,
    );
    process.exit(error.status || 1);
  }
}
