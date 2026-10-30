import { listCompanyIds, loadStore } from "./store";
import { startSync } from "./sync";

/** Syncs every connected agency, one at a time to stay well inside GHL rate limits. */
export async function runScheduledSyncs(): Promise<string[]> {
  const started: string[] = [];
  for (const id of await listCompanyIds()) {
    const store = await loadStore(id);
    if (!store || store.mode !== "live" || !store.auth || store.sync.running) continue;
    started.push(id);
    try {
      await startSync(store);
    } catch (e) {
      console.error(`[scheduler] sync failed for ${id}`, e);
    }
  }
  return started;
}

const g = globalThis as unknown as { __gvScheduler?: NodeJS.Timeout };

/** In-process schedule for long-running Node hosts. AUTO_SYNC_HOURS=0 disables it (use /api/cron/sync instead). */
export function startScheduler() {
  const hours = Number(process.env.AUTO_SYNC_HOURS ?? 6);
  if (!(hours > 0) || g.__gvScheduler) return;
  let running = false;
  g.__gvScheduler = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const ids = await runScheduledSyncs();
      if (ids.length) console.log(`[scheduler] synced ${ids.length} agenc${ids.length === 1 ? "y" : "ies"}`);
    } finally {
      running = false;
    }
  }, hours * 3600_000);
  g.__gvScheduler.unref?.();
  console.log(`[scheduler] auto-sync every ${hours}h`);
}
