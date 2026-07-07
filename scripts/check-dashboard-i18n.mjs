import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const budgetPath = path.join(root, "scripts", "dashboard-i18n-budget.json");
const scope = [
  "app/admin",
  "app/coach",
  "app/player",
  "app/parent",
  "components/layout",
  "components/chat",
  "components/parents",
  "components/custom-data",
];
const extensions = new Set([".ts", ".tsx"]);
const ignoredDirectories = new Set([
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
]);
const ignoredExactValues = new Set([
  "AR",
  "EN",
  "AI",
  "API",
  "CSV",
  "DOB",
  "FAQ",
  "ID",
  "MFA",
  "QR",
  "RW",
  "LW",
  "ST",
  "CM",
  "CB",
  "LB",
  "RB",
  "GK",
  "Goalix",
  "GOALIX",
  "Ctrl F",
  "Africa/Cairo",
  "Asia/Riyadh",
  "Europe/London",
  "main_position",
]);

const ignoredPathPatterns = [];

function collectFiles(directory) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];

  const files = [];
  const stack = [absolute];

  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      if (ignoredDirectories.has(entry.name)) continue;

      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }

      if (entry.isFile() && extensions.has(path.extname(entry.name))) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

function lineNumberForIndex(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function shouldIgnore(value) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.length < 3) return true;
  if (ignoredExactValues.has(trimmed)) return true;
  if (/\b(Promise|RequestInit|ApiEnvelope)\b/.test(trimmed)) return true;
  if (/[{}]/.test(trimmed)) return true;
  if (/[?&|]=?|=>|===|!==|>=|<=/.test(trimmed)) return true;
  if (/\b(option|startMs|nowMs|diff|numeric|value|payload|role)\b/.test(trimmed)) return true;
  if (/^[\d\s.,:+\-/%#()]+$/.test(trimmed)) return true;
  if (/^\+?\d[\dxX\s().+-]+$/.test(trimmed)) return true;
  if (/^(https?:|mailto:|tel:|data:|blob:)/i.test(trimmed)) return true;
  if (/^[A-Z0-9_./:-]+$/.test(trimmed)) return true;
  if (/^[a-z][a-z0-9-]*$/.test(trimmed)) return true;
  return false;
}

function collectFindings(file) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  if (ignoredPathPatterns.some((pattern) => pattern.test(relative))) {
    return [];
  }
  const findings = [];
  const patterns = [
    {
      kind: "attribute",
      regex: /\b(placeholder|aria-label|title)=["']([^"']*[A-Za-z][^"']*)["']/g,
      valueIndex: 2,
    },
    {
      kind: "text",
      regex: />[\t ]*([^<>{}\r\n]*[A-Za-z][^<>{}\r\n]*)[\t ]*</g,
      valueIndex: 1,
    },
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.regex.exec(source))) {
      const value = match[pattern.valueIndex];
      if (shouldIgnore(value)) continue;
      findings.push({
        file: relative,
        line: lineNumberForIndex(source, match.index),
        kind: pattern.kind,
        value: value.replace(/\s+/g, " ").trim(),
      });
    }
  }

  return findings;
}

const findings = scope
  .flatMap(collectFiles)
  .flatMap(collectFindings)
  .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

const budget = fs.existsSync(budgetPath)
  ? JSON.parse(fs.readFileSync(budgetPath, "utf8"))
  : null;
const maxFindings = Number(budget?.maxFindings ?? Number.POSITIVE_INFINITY);

if (findings.length > maxFindings) {
  console.error(
    `Dashboard i18n check failed: ${findings.length} static English findings, budget is ${maxFindings}.`,
  );
  findings.slice(0, 50).forEach((finding) => {
    console.error(
      `- ${finding.file}:${finding.line} [${finding.kind}] ${JSON.stringify(finding.value)}`,
    );
  });
  process.exit(1);
}

console.log(
  `Dashboard i18n check passed: ${findings.length} static English findings (budget ${maxFindings}).`,
);
if (!budget) {
  findings.slice(0, 20).forEach((finding) => {
    console.log(
      `- ${finding.file}:${finding.line} [${finding.kind}] ${JSON.stringify(finding.value)}`,
    );
  });
}
