import { NextResponse } from "next/server";
import { ghlConfigured } from "@/lib/ghl/oauth";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    oauthConfigured: ghlConfigured(),
    webhookVerification: Boolean(process.env.GHL_WEBHOOK_ED25519_PUBLIC_KEY || process.env.GHL_WEBHOOK_PUBLIC_KEY),
    tokenEncryption: process.env.TOKEN_ENCRYPTION_KEY ? "dedicated key" : "derived from SESSION_SECRET",
    autoSyncHours: Number(process.env.AUTO_SYNC_HOURS ?? 6),
  });
}
