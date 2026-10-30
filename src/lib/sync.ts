import type { Account, CompanyStore, DailyMetric } from "./types";
import { saveStore } from "./store";
import { dayKey } from "./dates";
import { listLocations, fetchLeadDates, fetchWonRevenue, fetchAppointments, fetchAdSpend, getCompanyName, getLocation, type GhlLocation } from "./ghl/resources";
import { sendChurnAlerts } from "./alerts";
import { buildDemoStore } from "./demo";

const running = new Map<string, Promise<void>>();

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

/** Starts a background sync for the company if one isn't already running. */
export function startSync(store: CompanyStore): Promise<void> {
  const existing = running.get(store.companyId);
  if (existing) return existing;
  const p = (store.mode === "demo" ? syncDemo(store) : syncLive(store)).finally(() => running.delete(store.companyId));
  running.set(store.companyId, p);
  return p;
}

async function syncDemo(store: CompanyStore) {
  store.sync = { running: true, startedAt: new Date().toISOString(), total: 100, done: 0, errors: 0, message: "Pulling sub-accounts…" };
  const fresh = buildDemoStore();
  for (let i = 0; i < 100; i += 10) {
    await new Promise((r) => setTimeout(r, 120));
    store.sync.done = i + 10;
  }
  // Keep user-set overrides across a re-sync.
  for (const [id, acc] of Object.entries(fresh.accounts)) {
    const old = store.accounts[id];
    store.accounts[id] = { ...acc, dailySpendOverride: old?.dailySpendOverride, churnThresholdOverride: old?.churnThresholdOverride, importedSpend: old?.importedSpend };
  }
  store.sync = { running: false, startedAt: store.sync.startedAt, finishedAt: new Date().toISOString(), total: 100, done: 100, errors: 0 };
  await saveStore(store);
}

async function syncLive(store: CompanyStore) {
  store.sync = { running: true, startedAt: new Date().toISOString(), total: 0, done: 0, errors: 0, message: "Listing sub-accounts…" };
  try {
    if (!store.companyName) store.companyName = await getCompanyName(store);
    const locations = await listLocations(store);
    store.sync.total = locations.length;
    store.sync.message = undefined;

    // Drop accounts that no longer exist / uninstalled.
    const keep = new Set(locations.map((l) => l.id));
    for (const id of Object.keys(store.accounts)) if (!keep.has(id)) delete store.accounts[id];

    const { from, to } = syncWindow(store);

    let sinceSave = 0;
    await pool(locations, 4, async (loc) => {
      if (!(await syncLocation(store, loc, from, to))) store.sync.errors++;
      store.sync.done++;
      if (++sinceSave >= 10) { sinceSave = 0; await saveStore(store); }
    });
    store.sync.message = store.sync.errors ? `${store.sync.errors} sub-account(s) failed to sync` : undefined;
  } catch (e: any) {
    store.sync.message = String(e?.message ?? e).slice(0, 300);
    store.sync.errors++;
  } finally {
    store.sync.running = false;
    store.sync.finishedAt = new Date().toISOString();
    await saveStore(store);
  }
  await sendChurnAlerts(store).catch((e) => console.error("[alerts]", e));
}

function syncWindow(store: CompanyStore) {
  const to = new Date();
  const from = new Date(to.getTime() - store.settings.syncWindowDays * 86400_000);
  from.setUTCHours(0, 0, 0, 0);
  return { from, to };
}

/** Syncs one sub-account into the store. Returns false if it failed (error is kept on the account). */
async function syncLocation(store: CompanyStore, loc: GhlLocation, from: Date, to: Date): Promise<boolean> {
  const prev = store.accounts[loc.id];
  const account: Account = {
    id: loc.id,
    name: loc.name,
    city: loc.city,
    state: loc.state,
    timezone: loc.timezone,
    daily: prev?.daily ?? [],
    dailySpendOverride: prev?.dailySpendOverride,
    churnThresholdOverride: prev?.churnThresholdOverride,
    importedSpend: prev?.importedSpend,
  };
  let ok = true;
  try {
    const tz = loc.timezone || "UTC";
    const [leadDates, wins, appts, spend] = await Promise.all([
      fetchLeadDates(store, loc.id, from, to),
      fetchWonRevenue(store, loc.id, from),
      fetchAppointments(store, loc.id, from, to),
      fetchAdSpend(store, loc.id, store.settings.adSpendCustomValueKey).catch(() => null),
    ]);
    const byDay = new Map<string, DailyMetric>();
    // Step from the window start and always include "today" in the sub-account's timezone –
    // stepping from UTC midnight alone misses it for timezones west of UTC.
    for (const t of [...Array.from({ length: Math.ceil((to.getTime() - from.getTime()) / 86400_000) + 1 }, (_, i) => from.getTime() + i * 86400_000), to.getTime()]) {
      if (t > to.getTime()) continue;
      const k = dayKey(t, tz);
      if (!byDay.has(k)) byDay.set(k, { date: k, leads: 0, booked: 0, showed: 0, noShow: 0, revenue: 0, spend: 0 });
    }
    const get = (iso: string) => byDay.get(dayKey(iso, tz));
    for (const d of leadDates) { const m = get(d); if (m) m.leads++; }
    for (const w of wins) { const m = get(w.date); if (m) m.revenue += w.value; }
    for (const a of appts) {
      const m = get(a.startTime);
      if (!m || a.status === "cancelled" || a.status === "invalid") continue;
      m.booked++;
      if (a.status === "showed") m.showed++;
      else if (a.status === "noshow" || a.status === "no_show") m.noShow++;
    }
    if (typeof spend === "number") for (const m of byDay.values()) m.spend = spend;
    else if (spend) for (const [k, v] of Object.entries(spend)) { const m = byDay.get(k); if (m) m.spend = v; }

    account.daily = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
    account.lastSyncedAt = new Date().toISOString();
    account.syncError = undefined;
  } catch (e: any) {
    account.syncError = e?.status === 401 || e?.status === 403
      ? "No access – is the app installed on this sub-account?"
      : String(e?.message ?? e).slice(0, 240);
    ok = false;
  }
  store.accounts[loc.id] = account;
  return ok;
}

/** Syncs a single sub-account by id, e.g. right after the app is installed on it. */
export async function syncSingleLocation(store: CompanyStore, locationId: string): Promise<boolean> {
  if (store.mode !== "live") return false;
  const loc = await getLocation(store, locationId);
  const { from, to } = syncWindow(store);
  const ok = await syncLocation(store, loc, from, to);
  await saveStore(store);
  return ok;
}
