import { NextResponse } from "next/server";
import { getStoreForSession, unauthorized } from "@/lib/context";
import { refreshJobs } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await getStoreForSession();
  if (!store) return unauthorized();
  return NextResponse.json({ jobs: await refreshJobs(store) });
}
