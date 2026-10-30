import { NextResponse } from "next/server";
import { getStoreForSession, unauthorized } from "@/lib/context";
import { saveStore } from "@/lib/store";

const optNum = (v: unknown) => (v === null || v === "" ? undefined : Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : undefined);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const store = await getStoreForSession();
  if (!store) return unauthorized();
  const acc = store.accounts[params.id];
  if (!acc) return NextResponse.json({ error: "Unknown account" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if ("dailySpendOverride" in body) acc.dailySpendOverride = optNum(body.dailySpendOverride);
  if ("churnThresholdOverride" in body) acc.churnThresholdOverride = optNum(body.churnThresholdOverride);
  await saveStore(store);
  return NextResponse.json({ ok: true });
}
