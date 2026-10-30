import { NextResponse } from "next/server";
import { getStoreForSession, unauthorized } from "@/lib/context";
import { createPushJob } from "@/lib/push";

export async function POST(req: Request) {
  const store = await getStoreForSession();
  if (!store) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const targetIds: string[] = Array.isArray(body.targetIds) ? body.targetIds.filter((id: unknown) => typeof id === "string" && store.accounts[id as string]) : [];
  if (!body.snapshotId || typeof body.snapshotId !== "string") return NextResponse.json({ error: "Pick a snapshot" }, { status: 400 });
  if (!targetIds.length) return NextResponse.json({ error: "Pick at least one target sub-account" }, { status: 400 });
  if (targetIds.length > 200) return NextResponse.json({ error: "Max 200 targets per push" }, { status: 400 });
  const job = await createPushJob(store, {
    snapshotId: body.snapshotId,
    snapshotName: String(body.snapshotName ?? body.snapshotId).slice(0, 200),
    sourceLocationId: typeof body.sourceLocationId === "string" ? body.sourceLocationId : undefined,
    targetIds: targetIds.filter((id) => id !== body.sourceLocationId),
    override: Boolean(body.override),
  });
  return NextResponse.json({ job }, { status: 201 });
}
