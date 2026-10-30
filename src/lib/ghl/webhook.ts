import crypto from "crypto";

const pem = (k: string) => k.replace(/\\n/g, "\n").trim();

/**
 * Verifies a HighLevel marketplace webhook.
 *  - `x-ghl-signature`: Ed25519 over the raw body (GHL_WEBHOOK_ED25519_PUBLIC_KEY)
 *  - `x-wh-signature`:  RSA-SHA256 over the raw body (GHL_WEBHOOK_PUBLIC_KEY, legacy)
 * Both public keys are published in HighLevel's webhook docs; paste them into env as PEM.
 */
export function verifyGhlWebhook(rawBody: string, headers: Headers): { ok: boolean; reason?: string } {
  const edKey = process.env.GHL_WEBHOOK_ED25519_PUBLIC_KEY;
  const rsaKey = process.env.GHL_WEBHOOK_PUBLIC_KEY;
  if (!edKey && !rsaKey) {
    if (process.env.NODE_ENV === "production" && process.env.GHL_WEBHOOK_ALLOW_UNSIGNED !== "true") {
      return { ok: false, reason: "No webhook public key configured" };
    }
    return { ok: true, reason: "unverified (no key configured, non-production)" };
  }
  const body = Buffer.from(rawBody, "utf8");
  const ed = headers.get("x-ghl-signature");
  if (ed && edKey) {
    try {
      if (crypto.verify(null, body, pem(edKey), Buffer.from(ed, "base64"))) return { ok: true };
    } catch { /* fall through */ }
  }
  const rsa = headers.get("x-wh-signature");
  if (rsa && rsaKey) {
    try {
      if (crypto.verify("sha256", body, pem(rsaKey), Buffer.from(rsa, "base64"))) return { ok: true };
    } catch { /* fall through */ }
  }
  return { ok: false, reason: "Invalid or missing signature" };
}
