import { NextResponse } from "next/server";
import { getStoreForSession, unauthorized } from "@/lib/context";
import { createPushJob } from "@/lib/push";

/** Re-pushes the snapshot to every target that failed in a previous job. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const store = await getStoreForSession();
  if (!store) return unauthorized();
  const job = store.pushJobs.find((j) => j.id === params.id);
  if (!job) return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  const failed = job.targets.filter((t) => t.status === "failed" && store.accounts[t.locationId]).map((t) => t.locationId);
  if (!failed.length) return NextResponse.json({ error: "Nothing to retry" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const retry = await createPushJob(store, {
    snapshotId: job.snapshotId,
    snapshotName: job.snapshotName,
    sourceLocationId: job.sourceLocationId,
    targetIds: failed,
    override: typeof body.override === "boolean" ? body.override : job.override,
  });
  return NextResponse.json({ job: retry }, { status: 201 });
}
