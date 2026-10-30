import crypto from "crypto";
import type { CompanyStore, PushJob, PushTargetStatus } from "./types";
import { saveStore } from "./store";
import { pushSnapshot, snapshotPushStatus } from "./ghl/resources";
import { advanceDemoJob } from "./demo";

export async function createPushJob(
  store: CompanyStore,
  input: { snapshotId: string; snapshotName: string; sourceLocationId?: string; targetIds: string[]; override: boolean },
): Promise<PushJob> {
  const now = new Date().toISOString();
  const job: PushJob = {
    id: crypto.randomUUID(),
    createdAt: now,
    snapshotId: input.snapshotId,
    snapshotName: input.snapshotName,
    sourceLocationId: input.sourceLocationId,
    sourceName: input.sourceLocationId ? store.accounts[input.sourceLocationId]?.name : undefined,
    override: input.override,
    targets: input.targetIds.map((id) => ({ locationId: id, name: store.accounts[id]?.name ?? id, status: "queued", updatedAt: now })),
  };
  store.pushJobs.unshift(job);
  store.pushJobs = store.pushJobs.slice(0, 50);
  await saveStore(store);
  if (store.mode === "live") void runLiveJob(store, job);
  return job;
}

async function runLiveJob(store: CompanyStore, job: PushJob) {
  // Pushes are heavy on GHL's side – keep it gentle, 2 at a time.
  const queue = [...job.targets];
  await Promise.all([0, 1].map(async () => {
    for (let t = queue.shift(); t; t = queue.shift()) {
      t.status = "pushing";
      t.updatedAt = new Date().toISOString();
      try {
        await pushSnapshot(store, t.locationId, job.snapshotId, job.override);
        t.status = "processing";
      } catch (e: any) {
        t.status = "failed";
        t.message = String(e?.message ?? e).slice(0, 240);
      }
      t.updatedAt = new Date().toISOString();
      await saveStore(store);
    }
  }));
}

function normalise(s: string | null): PushTargetStatus | null {
  if (!s) return null;
  if (/complete|success|done|finished/.test(s)) return "completed";
  if (/fail|error/.test(s)) return "failed";
  return "processing";
}

/** Refreshes the status of in-flight targets (from GHL, or simulated in demo). */
export async function refreshJobs(store: CompanyStore): Promise<PushJob[]> {
  let changed = false;
  for (const job of store.pushJobs.slice(0, 10)) {
    if (store.mode === "demo") { advanceDemoJob(job); changed = true; continue; }
    for (const t of job.targets) {
      if (t.status !== "processing") continue;
      // Give up polling after 30 minutes; GHL usually finishes in a few.
      if (Date.now() - new Date(t.updatedAt).getTime() > 30 * 60_000) continue;
      try {
        const s = normalise(await snapshotPushStatus(store, job.snapshotId, t.locationId));
        if (s && s !== t.status) { t.status = s; t.updatedAt = new Date().toISOString(); changed = true; }
      } catch { /* transient; try again next poll */ }
    }
  }
  if (changed) await saveStore(store);
  return store.pushJobs;
}
