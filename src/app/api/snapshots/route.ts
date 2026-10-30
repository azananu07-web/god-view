import { NextResponse } from "next/server";
import { getStoreForSession, unauthorized } from "@/lib/context";
import { listSnapshots } from "@/lib/ghl/resources";
import { DEMO_SNAPSHOTS } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await getStoreForSession();
  if (!store) return unauthorized();
  if (store.mode === "demo") return NextResponse.json({ snapshots: DEMO_SNAPSHOTS });
  try {
    return NextResponse.json({ snapshots: await listSnapshots(store) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to load snapshots" }, { status: 502 });
  }
}
