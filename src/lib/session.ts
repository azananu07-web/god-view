import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE = "gv_session";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (16+ chars)");
    return "dev-only-insecure-session-secret";
  }
  return s;
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

export function encodeSession(companyId: string) {
  const v = Buffer.from(companyId).toString("base64url");
  return `${v}.${sign(v)}`;
}

export function decodeSession(raw: string | undefined): string | null {
  if (!raw) return null;
  const [v, sig] = raw.split(".");
  if (!v || !sig) return null;
  const expected = sign(v);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return Buffer.from(v, "base64url").toString();
}

export function getSessionCompanyId(): string | null {
  return decodeSession(cookies().get(COOKIE)?.value);
}

export const sessionCookie = {
  name: COOKIE,
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  },
};
