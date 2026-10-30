import { NextResponse } from "next/server";
import { verifyGhlWebhook } from "@/lib/ghl/webhook";
import { deleteStore, loadStore, saveStore } from "@/lib/store";
import { startSync, syncSingleLocation } from "@/lib/sync";

export const dynamic = "force-dynamic";

/**
 * HighLevel app webhooks (set the app's Webhook URL to https://<host>/api/webhooks/ghl and subscribe to
 * INSTALL, UNINSTALL and LocationCreate).
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const check = verifyGhlWebhook(raw, req.headers);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 401 });

  let evt: any;
  try { evt = JSON.parse(raw); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }

  const appId = process.env.GHL_APP_ID;
  if (appId && evt.appId && !String(evt.appId).startsWith(appId)) return NextResponse.json({ ignored: "other app" });

  const companyId: string | undefined = evt.companyId;
  if (!companyId) return NextResponse.json({ ignored: "no companyId" });
  const store = await loadStore(companyId);
  if (!store) return NextResponse.json({ ignored: "unknown company" });

  // Idempotency: HighLevel retries deliveries.
  const eventId: string | undefined = evt.webhookId ?? evt.id;
  if (eventId) {
    if (store.processedWebhooks?.includes(eventId)) return NextResponse.json({ duplicate: true });
    store.processedWebhooks = [eventId, ...(store.processedWebhooks ?? [])].slice(0, 200);
  }

  const type = String(evt.type ?? "").toUpperCase();
  const locationId: string | undefined = evt.locationId;

  if (type === "UNINSTALL") {
    if (!locationId) {
      // Agency-level uninstall: revoke everything and delete the agency's data.
      await deleteStore(companyId);
      return NextResponse.json({ ok: true, action: "agency data deleted" });
    }
    delete store.accounts[locationId];
    delete store.locationTokens[locationId];
    store.alertedChurn = store.alertedChurn?.filter((id) => id !== locationId);
    await saveStore(store);
    return NextResponse.json({ ok: true, action: "sub-account removed" });
  }

  if (type === "INSTALL" || type === "LOCATIONCREATE") {
    const id: string | undefined = type === "LOCATIONCREATE" ? evt.id ?? locationId : locationId;
    await saveStore(store);
    if (id) {
      void syncSingleLocation(store, id).catch((e) => console.error("[webhook] sync", e));
      return NextResponse.json({ ok: true, action: "syncing sub-account" });
    }
    void startSync(store);
    return NextResponse.json({ ok: true, action: "full sync" });
  }

  await saveStore(store);
  return NextResponse.json({ ignored: type || "unknown" });
}
