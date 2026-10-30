import { NextResponse } from "next/server";
import { getStoreForSession, unauthorized } from "@/lib/context";
import { startSync } from "@/lib/sync";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await getStoreForSession();
  if (!store) return unauthorized();
  return NextResponse.json(store.sync);
}

export async function POST() {
  const store = await getStoreForSession();
  if (!store) return unauthorized();
  void startSync(store);
  await new Promise((r) => setTimeout(r, 50));
  return NextResponse.json(store.sync, { status: 202 });
}
