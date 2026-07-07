#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { createHash } = require('node:crypto');

const PLACEHOLDER_BCRYPT =
    '$2b$12$C6UzMDM.H6dfI/f/IKcEeO8UV7M0ICl8wHnGdVYex3X3QX/vSW9i.';

function usage() {
    console.error('Usage: node scripts/sanitize-sql-dump.js <input.sql> <output.sql>');
    process.exit(1);
}

function hash(value, length = 12) {
    return createHash('sha256').update(String(value)).digest('hex').slice(0, length);
}

function hashDigits(value, length = 10) {
    return hash(value, length).replace(/[a-f]/g, (char) => String(char.charCodeAt(0) % 10));
}

function quoteSqlString(value) {
    return `'${String(value).replace(/'/g, "''")}'`;
}

function fakeEmail(value) {
    return `user_${hash(value)}@example.invalid`;
}

function fakePhone(value) {
    return `010${hashDigits(value, 8)}`;
}

function fakeName(value, label = 'User') {
    return `${label} ${hash(value, 8)}`;
}

function sanitizeByColumn(column, value) {
    if (value === '\\N' || value === '') return value;
    const name = String(column || '').toLowerCase();
    if (name.includes('email')) return fakeEmail(value);
    if (name.includes('phone') || name.includes('mobile')) return fakePhone(value);
    if (name.includes('password') || name.endsWith('_hash')) return PLACEHOLDER_BCRYPT;
    if (name.includes('totp') || name.includes('secret') || name.includes('token')) return '\\N';
    if (name.includes('address')) return `Redacted address ${hash(value, 8)}`;
    if (['name', 'full_name', 'first_name', 'last_name', 'guardian_name'].includes(name)) {
        return fakeName(value, name.replace(/_/g, ' '));
    }
    return value;
}

function sanitizeSqlStringLiteral(inner) {
    const value = inner.replace(/''/g, "'");
    if (/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value)) {
        return quoteSqlString(PLACEHOLDER_BCRYPT);
    }
    if (/^[^\s@']+@[^\s@']+\.[^\s@']+$/.test(value)) {
        return quoteSqlString(fakeEmail(value));
    }
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 16 && /^[+\d\s().-]+$/.test(value)) {
        return quoteSqlString(fakePhone(value));
    }
    return quoteSqlString(value);
}

function sanitizeInsertLine(line) {
    return line.replace(/'((?:''|[^'])*)'/g, (_match, inner) => sanitizeSqlStringLiteral(inner));
}

function parseCopyColumns(line) {
    const match = line.match(/^COPY\s+(?:"?[\w-]+"?\.)?"?[\w-]+"?\s+\((.+)\)\s+FROM\s+stdin;/i);
    if (!match) return null;
    return match[1]
        .split(',')
        .map((value) => value.trim().replace(/^"|"$/g, ''));
}

async function main() {
    const [, , inputPath, outputPath] = process.argv;
    if (!inputPath || !outputPath) usage();

    const absoluteInput = path.resolve(inputPath);
    const absoluteOutput = path.resolve(outputPath);
    if (absoluteInput === absoluteOutput) {
        console.error('Input and output must be different files.');
        process.exit(1);
    }

    let copyColumns = null;
    const input = fs.createReadStream(absoluteInput, { encoding: 'utf8' });
    const output = fs.createWriteStream(absoluteOutput, { encoding: 'utf8', flags: 'wx' });
    const reader = readline.createInterface({ input, crlfDelay: Infinity });

    for await (const line of reader) {
        const columns = parseCopyColumns(line);
        if (columns) {
            copyColumns = columns;
            output.write(`${line}\n`);
            continue;
        }

        if (copyColumns) {
            if (line === '\\.') {
                copyColumns = null;
                output.write(`${line}\n`);
                continue;
            }
            const fields = line.split('\t').map((value, index) => sanitizeByColumn(copyColumns[index], value));
            output.write(`${fields.join('\t')}\n`);
            continue;
        }

        output.write(`${sanitizeInsertLine(line)}\n`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
