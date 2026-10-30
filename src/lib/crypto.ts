import crypto from "crypto";

const PREFIX = "enc:v1:";

/**
 * AES-256-GCM key for tokens at rest. TOKEN_ENCRYPTION_KEY (32 bytes, hex or base64) is preferred;
 * otherwise a key is derived from SESSION_SECRET so tokens are never written in plaintext.
 */
function key(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (raw) {
    const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64)");
    return buf;
  }
  const secret = process.env.SESSION_SECRET || "dev-only-insecure-session-secret";
  return crypto.createHash("sha256").update("gv-token-key:" + secret).digest();
}

export function encrypt(plain: string): string {
  if (!plain || plain.startsWith(PREFIX)) return plain;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
}

export function decrypt(value: string): string {
  if (!value || !value.startsWith(PREFIX)) return value; // legacy plaintext
  const buf = Buffer.from(value.slice(PREFIX.length), "base64url");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}
