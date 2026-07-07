import { execFileSync } from "node:child_process";
import path from "node:path";

const blockedExtensions = new Set([
  ".bin",
  ".ckpt",
  ".h5",
  ".joblib",
  ".onnx",
  ".pkl",
  ".pt",
  ".pth",
  ".tar",
  ".zip",
]);

let trackedFiles = "";

try {
  trackedFiles = execFileSync("git", ["ls-files", "Models"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
} catch {
  console.warn("Skipping model artifact check because git is unavailable.");
  process.exit(0);
}

const offenders = trackedFiles
  .split(/\r?\n/)
  .map((file) => file.trim())
  .filter(Boolean)
  .filter(
    (file) =>
      blockedExtensions.has(path.extname(file).toLowerCase()) ||
      /(^|\/)[^/]+\.pth\//i.test(file) ||
      /(^|\/)[^/]+\.pt\//i.test(file),
  );

if (offenders.length) {
  console.error("Tracked model artifacts found. Keep large model binaries outside git:");
  for (const file of offenders) console.error(`- ${file}`);
  console.error("Use git rm --cached <file> to untrack while keeping the local file.");
  process.exit(1);
}

console.log("No tracked model artifacts found.");
