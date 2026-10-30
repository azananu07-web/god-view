import crypto from "crypto";
import { NextResponse } from "next/server";
import { runScheduledSyncs } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** External cron trigger (Vercel Cron, GitHub Actions, cron-job.org…). Send `Authorization: Bearer $CRON_SECRET`. */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (got.length !== want.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const synced = await runScheduledSyncs();
  return NextResponse.json({ synced });
}

export const GET = handle;
export const POST = handle;
