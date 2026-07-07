#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const dumpPattern = /(^|\/).*\.(sql|dump|backup)(\.(gz|zip|7z|bz2|xz))?$/i;

let tracked = '';
try {
  tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' });
} catch {
  console.error('Could not inspect tracked files with git ls-files.');
  process.exit(1);
}

const offenders = tracked
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => dumpPattern.test(file.replace(/\\/g, '/')));

if (offenders.length) {
  console.error('Database dump-like files are tracked by git. Remove them before committing:');
  offenders.forEach((file) => console.error(`  - ${file}`));
  process.exit(1);
}

console.log('No tracked database dump files found.');
