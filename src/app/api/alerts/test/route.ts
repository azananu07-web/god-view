import { NextResponse } from "next/server";
import { getStoreForSession, unauthorized } from "@/lib/context";
import { postAlert, validAlertUrl } from "@/lib/alerts";

export async function POST() {
  const store = await getStoreForSession();
  if (!store) return unauthorized();
  const url = store.settings.alertWebhookUrl;
  if (!url || !validAlertUrl(url)) return NextResponse.json({ error: "Save an https:// alert webhook URL first" }, { status: 400 });
  try {
    await postAlert(url, `:wave: God View test alert for ${store.companyName ?? "your agency"}. Churn alerts will arrive here.`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Webhook failed" }, { status: 502 });
  }
}
