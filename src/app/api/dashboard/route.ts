import { NextResponse } from "next/server";
import { getStoreForSession, unauthorized } from "@/lib/context";
import { computeDashboard } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const store = await getStoreForSession();
  if (!store) return unauthorized();
  const days = Math.min(90, Math.max(7, Number(new URL(req.url).searchParams.get("days")) || 30));
  return NextResponse.json(computeDashboard(store, days));
}
