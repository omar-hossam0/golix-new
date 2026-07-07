import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_TARGETS = ["app", "components", "lib", "golx-backend/src", "scripts"];
const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
]);
const SKIP_DIRS = new Set([
  ".git",
  ".next",
  "coverage",
  "node_modules",
  "playwright-report",
  "test-results",
]);

const ARTIFACT_PATTERNS = [
  { name: "replacement character", regex: /\uFFFD/ },
  { name: "latin-1 artifact", regex: /[\u00c2\u00c3]/ },
  { name: "mojibake box or quote sequence", regex: /\u00e2[^\s]{1,5}/ },
  { name: "arabic mojibake lead", regex: /[\u00d8\u00d9][^\s]{1,12}/ },
];

function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), files);
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (!TEXT_EXTENSIONS.has(path.extname(entry.name))) continue;
    if (statSync(fullPath).size > 1024 * 1024) continue;
    files.push(fullPath);
  }

  return files;
}

function lineAndColumn(text, index) {
  const before = text.slice(0, index);
  const lines = before.split(/\r?\n/);
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

const findings = [];

for (const target of DEFAULT_TARGETS) {
  const fullTarget = path.join(ROOT, target);
  for (const file of walk(fullTarget)) {
    const text = readFileSync(file, "utf8");
    for (const pattern of ARTIFACT_PATTERNS) {
      const match = pattern.regex.exec(text);
      if (!match) continue;
      const position = lineAndColumn(text, match.index);
      findings.push({
        file: path.relative(ROOT, file).replaceAll(path.sep, "/"),
        line: position.line,
        column: position.column,
        pattern: pattern.name,
        sample: match[0],
      });
    }
  }
}

if (findings.length) {
  console.error("Text encoding artifacts found:");
  for (const finding of findings.slice(0, 80)) {
    console.error(
      `- ${finding.file}:${finding.line}:${finding.column} ${finding.pattern}: ${JSON.stringify(finding.sample)}`,
    );
  }
  if (findings.length > 80) {
    console.error(`...and ${findings.length - 80} more findings.`);
  }
  process.exit(1);
}

console.log("No text encoding artifacts found.");
