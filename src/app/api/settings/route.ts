import { NextResponse } from "next/server";
import { getStoreForSession, unauthorized } from "@/lib/context";
import { saveStore } from "@/lib/store";
import { validAlertUrl } from "@/lib/alerts";

export async function GET() {
  const store = await getStoreForSession();
  if (!store) return unauthorized();
  return NextResponse.json({
    settings: store.settings,
    mode: store.mode,
    companyId: store.companyId,
    companyName: store.companyName,
    connected: Boolean(store.auth),
    scope: store.auth?.scope,
    tokenExpiresAt: store.auth?.expiresAt,
  });
}

const clampInt = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
};

export async function PUT(req: Request) {
  const store = await getStoreForSession();
  if (!store) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const s = store.settings;
  s.churnThreshold = clampInt(body.churnThreshold, 0, 10_000) ?? s.churnThreshold;
  s.churnDays = clampInt(body.churnDays, 1, 30) ?? s.churnDays;
  s.syncWindowDays = clampInt(body.syncWindowDays, 14, 180) ?? s.syncWindowDays;
  if (typeof body.alertWebhookUrl === "string") {
    const url = body.alertWebhookUrl.trim();
    if (url && !validAlertUrl(url)) return NextResponse.json({ error: "Alert webhook must be an https:// URL" }, { status: 400 });
    s.alertWebhookUrl = url || undefined;
  }
  if (typeof body.alertOnRecovery === "boolean") s.alertOnRecovery = body.alertOnRecovery;
  if (typeof body.adSpendCustomValueKey === "string") s.adSpendCustomValueKey = body.adSpendCustomValueKey.trim().slice(0, 100);
  await saveStore(store);
  return NextResponse.json({ settings: s });
}
