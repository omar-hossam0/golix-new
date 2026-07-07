const { spawn } = require("child_process");
const { createHash } = require("crypto");
const fs = require("fs");
const path = require("path");

const MODEL_VERSION = "football_ranking_model";
const DEFAULT_TIMEOUT_MS = Number(process.env.RANKING_MODEL_TIMEOUT_MS || 60000);
const CACHE_TTL_MS = Math.max(0, Number(process.env.RANKING_MODEL_CACHE_TTL_MS || 30000));
const CACHE_MAX_ENTRIES = Math.max(1, Number(process.env.RANKING_MODEL_CACHE_MAX_ENTRIES || 100));
const predictionCache = new Map();

const modelDir =
    process.env.RANKING_MODEL_DIR ||
    path.resolve(__dirname, "../../../..", "Models", "Ranking Model");
const scriptPath =
    process.env.RANKING_MODEL_SCRIPT || path.join(modelDir, "inference.py");
const projectPython =
    process.platform === "win32"
        ? path.resolve(__dirname, "../../../..", ".venv", "Scripts", "python.exe")
        : path.resolve(__dirname, "../../../..", ".venv", "bin", "python");
const pythonBin =
    resolvePythonBin([
        process.env.RANKING_PYTHON_BIN,
        process.env.PYTHON_BIN,
        process.env.PYTHON,
        projectPython,
        process.platform === "win32" ? "python" : "python3",
        "python",
    ]);

function isFilePath(value) {
    return path.isAbsolute(value) || value.includes("/") || value.includes("\\");
}

function resolvePythonBin(candidates) {
    for (const candidate of candidates.filter(Boolean)) {
        if (!isFilePath(candidate) || fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return process.platform === "win32" ? "python" : "python3";
}

function cacheKeyForRecords(records) {
    return createHash("sha256")
        .update(MODEL_VERSION)
        .update("\0")
        .update(JSON.stringify(records))
        .digest("hex");
}

function getCachedPrediction(key) {
    if (!CACHE_TTL_MS) return null;
    const cached = predictionCache.get(key);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
        predictionCache.delete(key);
        return null;
    }
    predictionCache.delete(key);
    predictionCache.set(key, cached);
    return cached.value;
}

function setCachedPrediction(key, value) {
    if (!CACHE_TTL_MS) return;
    predictionCache.set(key, {
        value,
        expiresAt: Date.now() + CACHE_TTL_MS,
    });
    while (predictionCache.size > CACHE_MAX_ENTRIES) {
        const oldestKey = predictionCache.keys().next().value;
        predictionCache.delete(oldestKey);
    }
}

function runRankingPredictions(records, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    const cacheKey = cacheKeyForRecords(records);
    const cached = getCachedPrediction(cacheKey);
    if (cached) return Promise.resolve(cached);

    return new Promise((resolve, reject) => {
        if (!fs.existsSync(scriptPath)) {
            reject(new Error(`Ranking model script was not found: ${scriptPath}`));
            return;
        }

        const child = spawn(pythonBin, [scriptPath, "--json-stdin"], {
            cwd: modelDir,
            windowsHide: true,
        });

        const stdout = [];
        const stderr = [];
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill("SIGKILL");
        }, timeoutMs);

        child.stdout.on("data", (chunk) => stdout.push(chunk));
        child.stderr.on("data", (chunk) => stderr.push(chunk));
        child.on("error", (error) => {
            clearTimeout(timer);
            reject(
                new Error(
                    `Could not start the ranking Python model with "${pythonBin}". ` +
                        `Set RANKING_PYTHON_BIN or PYTHON_BIN to a valid Python executable. ` +
                        `Original error: ${error.message}`,
                ),
            );
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            const errorOutput = Buffer.concat(stderr).toString("utf8").trim();
            const output = Buffer.concat(stdout).toString("utf8").trim();

            if (timedOut) {
                reject(new Error("Ranking model timed out"));
                return;
            }
            if (code !== 0) {
                reject(
                    new Error(errorOutput || `Ranking model exited with code ${code}`),
                );
                return;
            }

            try {
                const parsed = JSON.parse(output || "[]");
                setCachedPrediction(cacheKey, parsed);
                resolve(parsed);
            } catch (error) {
                reject(
                    new Error(`Could not parse ranking model output: ${error.message}`),
                );
            }
        });

        child.stdin.end(JSON.stringify(records));
    });
}

module.exports = {
    MODEL_VERSION,
    runRankingPredictions,
};
