const crypto = require("node:crypto");

const PREFIX = "enc:v1:";

function encryptionKey() {
  const raw = String(process.env.TOTP_ENCRYPTION_KEY || "").trim();
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const decoded = Buffer.from(raw, "base64");
  return decoded.length === 32 ? decoded : null;
}

function encrypt(secret, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(secret), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

async function encryptColumn(knex, tableName, columnName, key) {
  if (!(await knex.schema.hasTable(tableName))) return;
  const hasColumn = await knex.schema.hasColumn(tableName, columnName);
  if (!hasColumn) return;

  const rows = await knex(tableName)
    .whereNotNull(columnName)
    .whereNot(columnName, "like", `${PREFIX}%`)
    .select("id", columnName);

  for (const row of rows) {
    await knex(tableName)
      .where({ id: row.id })
      .update({
        [columnName]: encrypt(row[columnName], key),
        updated_at: knex.fn.now(),
      });
  }
}

exports.up = async function up(knex) {
  const key = encryptionKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "TOTP_ENCRYPTION_KEY must be configured before encrypting legacy MFA secrets",
      );
    }
    return;
  }

  await knex.transaction(async (trx) => {
    await encryptColumn(trx, "auth_users", "totp_secret", key);
    await encryptColumn(trx, "iam_users", "totp_secret", key);
    await encryptColumn(trx, "auth_totp_devices", "secret", key);
  });
};

exports.down = async function down() {
  // Encryption is intentionally irreversible in a rollback migration.
};
