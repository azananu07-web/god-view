import { promises as fs } from "fs";
import path from "path";
import type { CompanyStore, Settings } from "./types";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

export const DEFAULT_SETTINGS: Settings = {
  churnThreshold: 3,
  churnDays: 3,
  adSpendCustomValueKey: process.env.GHL_AD_SPEND_CUSTOM_VALUE || "ad_spend_daily",
  syncWindowDays: 60,
};

// Survive Next.js dev hot-reloads.
const g = globalThis as unknown as {
  __gvStores?: Map<string, CompanyStore>;
  __gvLocks?: Map<string, Promise<void>>;
};
const cache = (g.__gvStores ??= new Map());
const locks = (g.__gvLocks ??= new Map());

function fileFor(companyId: string) {
  return path.join(DATA_DIR, `company-${companyId.replace(/[^a-zA-Z0-9_-]/g, "")}.json`);
}

export function emptyStore(companyId: string, mode: "live" | "demo"): CompanyStore {
  return {
    companyId,
    mode,
    locationTokens: {},
    accounts: {},
    settings: { ...DEFAULT_SETTINGS },
    pushJobs: [],
    sync: { running: false, total: 0, done: 0, errors: 0 },
  };
}

export async function loadStore(companyId: string): Promise<CompanyStore | null> {
  const hit = cache.get(companyId);
  if (hit) return hit;
  try {
    const raw = await fs.readFile(fileFor(companyId), "utf8");
    const store = JSON.parse(raw) as CompanyStore;
    store.settings = { ...DEFAULT_SETTINGS, ...store.settings };
    // A sync can't still be running after a process restart.
    store.sync.running = false;
    cache.set(companyId, store);
    return store;
  } catch {
    return null;
  }
}

export async function saveStore(store: CompanyStore): Promise<void> {
  cache.set(store.companyId, store);
  // Serialise writes per company; write to temp then rename for atomicity.
  const prev = locks.get(store.companyId) ?? Promise.resolve();
  const next = prev.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const file = fileFor(store.companyId);
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(store));
    await fs.rename(tmp, file);
  });
  locks.set(store.companyId, next.catch(() => {}));
  return next;
}
