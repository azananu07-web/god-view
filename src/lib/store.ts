import { promises as fs } from "fs";
import path from "path";
import type { CompanyStore, Settings } from "./types";
import { decrypt, encrypt } from "./crypto";

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
    if (store.auth) {
      store.auth.accessToken = decrypt(store.auth.accessToken);
      store.auth.refreshToken = decrypt(store.auth.refreshToken);
    }
    for (const t of Object.values(store.locationTokens ?? {})) t.token = decrypt(t.token);
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
    await fs.writeFile(tmp, serialise(store), { mode: 0o600 });
    await fs.rename(tmp, file);
  });
  locks.set(store.companyId, next.catch(() => {}));
  return next;
}

/** JSON with every OAuth token encrypted. */
function serialise(store: CompanyStore): string {
  const out: CompanyStore = {
    ...store,
    auth: store.auth && { ...store.auth, accessToken: encrypt(store.auth.accessToken), refreshToken: encrypt(store.auth.refreshToken) },
    locationTokens: Object.fromEntries(Object.entries(store.locationTokens).map(([k, v]) => [k, { ...v, token: encrypt(v.token) }])),
  };
  return JSON.stringify(out);
}

/** Company ids that have a saved store (for scheduled syncs). */
export async function listCompanyIds(): Promise<string[]> {
  try {
    const files = await fs.readdir(DATA_DIR);
    return files.filter((f) => /^company-.+\.json$/.test(f)).map((f) => f.slice(8, -5));
  } catch {
    return [];
  }
}

export async function deleteStore(companyId: string): Promise<void> {
  cache.delete(companyId);
  await fs.rm(fileFor(companyId), { force: true });
}
