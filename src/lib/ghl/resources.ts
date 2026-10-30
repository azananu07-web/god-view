import type { CompanyStore, Snapshot } from "../types";
import { ghlFetch, getAgencyToken, getLocationToken } from "./client";

export type GhlLocation = { id: string; name: string; city?: string; state?: string; timezone?: string };

/** Every sub-account under the agency (paged). Falls back to installed-locations when an app id is set. */
export async function listLocations(store: CompanyStore): Promise<GhlLocation[]> {
  const token = await getAgencyToken(store);
  const out: GhlLocation[] = [];
  const limit = 100;
  for (let skip = 0; skip < 10_000; skip += limit) {
    const data = await ghlFetch<any>("/locations/search", token, {
      query: { companyId: store.companyId, limit, skip, order: "asc" },
    });
    const page: any[] = data.locations ?? [];
    for (const l of page) out.push({ id: l.id ?? l._id, name: l.name, city: l.city, state: l.state, timezone: l.timezone });
    if (page.length < limit) break;
  }

  // Location tokens can only be minted for sub-accounts where the app is installed.
  const appId = process.env.GHL_APP_ID;
  if (appId) {
    try {
      const data = await ghlFetch<any>("/oauth/installedLocations", token, {
        query: { companyId: store.companyId, appId, isInstalled: true, limit: 500 },
      });
      const installed = new Set<string>((data.locations ?? []).map((l: any) => l._id ?? l.id));
      if (installed.size) return out.filter((l) => installed.has(l.id));
    } catch {
      /* not fatal – we'll surface per-account token errors instead */
    }
  }
  return out;
}

export async function getLocation(store: CompanyStore, locationId: string): Promise<GhlLocation> {
  const token = await getAgencyToken(store);
  const data = await ghlFetch<any>(`/locations/${locationId}`, token);
  const l = data.location ?? data;
  return { id: l.id ?? l._id ?? locationId, name: l.name ?? locationId, city: l.city, state: l.state, timezone: l.timezone };
}

export async function getCompanyName(store: CompanyStore): Promise<string | undefined> {
  try {
    const token = await getAgencyToken(store);
    const data = await ghlFetch<any>(`/companies/${store.companyId}`, token);
    return data.company?.name;
  } catch {
    return undefined;
  }
}

/** Contacts created in [from, to]. Returns ISO dateAdded strings. */
export async function fetchLeadDates(store: CompanyStore, locationId: string, from: Date, to: Date): Promise<string[]> {
  const token = await getLocationToken(store, locationId);
  const out: string[] = [];
  const pageLimit = 100;
  for (let page = 1; page <= 100; page++) {
    const data = await ghlFetch<any>("/contacts/search", token, {
      body: {
        locationId,
        page,
        pageLimit,
        filters: [{ field: "dateAdded", operator: "range", value: { gte: from.toISOString(), lte: to.toISOString() } }],
        sort: [{ field: "dateAdded", direction: "desc" }],
      },
    });
    const contacts: any[] = data.contacts ?? [];
    for (const c of contacts) if (c.dateAdded) out.push(c.dateAdded);
    if (contacts.length < pageLimit) break;
  }
  return out;
}

/**
 * Won opportunities, attributed to the day they were marked won.
 * We look back an extra 120 days of creation date so long-cycle deals closed in-window are counted.
 */
export async function fetchWonRevenue(store: CompanyStore, locationId: string, from: Date): Promise<{ date: string; value: number }[]> {
  const token = await getLocationToken(store, locationId);
  const createdFrom = new Date(from.getTime() - 120 * 86400_000);
  const mmddyyyy = `${String(createdFrom.getMonth() + 1).padStart(2, "0")}-${String(createdFrom.getDate()).padStart(2, "0")}-${createdFrom.getFullYear()}`;
  const out: { date: string; value: number }[] = [];
  let startAfter: string | undefined;
  let startAfterId: string | undefined;
  for (let i = 0; i < 100; i++) {
    const data = await ghlFetch<any>("/opportunities/search", token, {
      query: { location_id: locationId, status: "won", date: mmddyyyy, limit: 100, startAfter, startAfterId },
    });
    const opps: any[] = data.opportunities ?? [];
    for (const o of opps) {
      const wonAt = o.lastStatusChangeAt ?? o.updatedAt ?? o.createdAt;
      if (wonAt && new Date(wonAt) >= from) out.push({ date: wonAt, value: Number(o.monetaryValue) || 0 });
    }
    startAfter = data.meta?.startAfter;
    startAfterId = data.meta?.startAfterId;
    if (opps.length < 100 || !startAfterId) break;
  }
  return out;
}

export type ApptEvent = { startTime: string; status: string };

/** Appointments across every calendar in the location. */
export async function fetchAppointments(store: CompanyStore, locationId: string, from: Date, to: Date): Promise<ApptEvent[]> {
  const token = await getLocationToken(store, locationId);
  const cals = await ghlFetch<any>("/calendars/", token, { query: { locationId } });
  const out: ApptEvent[] = [];
  for (const cal of cals.calendars ?? []) {
    const data = await ghlFetch<any>("/calendars/events", token, {
      query: { locationId, calendarId: cal.id, startTime: from.getTime(), endTime: to.getTime() },
    });
    for (const e of data.events ?? []) {
      if (e.deleted) continue;
      out.push({ startTime: e.startTime, status: String(e.appointmentStatus ?? e.status ?? "").toLowerCase() });
    }
  }
  return out;
}

/**
 * Ad spend from a sub-account custom value. GHL has no public ads-reporting API, so agencies
 * typically sync spend from Meta/Google into a custom value (Zapier, Make, n8n…).
 *   "41.20"                         -> average daily spend
 *   {"2026-10-29": 41.2, ...}       -> spend per day
 */
export async function fetchAdSpend(store: CompanyStore, locationId: string, key: string): Promise<number | Record<string, number> | null> {
  if (!key) return null;
  const token = await getLocationToken(store, locationId);
  const data = await ghlFetch<any>(`/locations/${locationId}/customValues`, token);
  const needle = key.toLowerCase();
  const cv = (data.customValues ?? []).find(
    (c: any) => String(c.fieldKey ?? "").toLowerCase().includes(needle) || String(c.name ?? "").toLowerCase().replace(/\s+/g, "_") === needle,
  );
  if (!cv || cv.value == null || cv.value === "") return null;
  const raw = String(cv.value).trim();
  if (raw.startsWith("{")) {
    try {
      const obj = JSON.parse(raw);
      return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, Number(v) || 0]));
    } catch {
      return null;
    }
  }
  const n = Number(raw.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// ---------- snapshots ----------

export async function listSnapshots(store: CompanyStore): Promise<Snapshot[]> {
  const token = await getAgencyToken(store);
  const data = await ghlFetch<any>("/snapshots/", token, { query: { companyId: store.companyId } });
  return (data.snapshots ?? []).map((s: any) => ({ id: s.id ?? s._id, name: s.name, type: s.type }));
}

/** Loads a snapshot into an existing sub-account (Update Sub-Account endpoint). */
export async function pushSnapshot(store: CompanyStore, locationId: string, snapshotId: string, override: boolean) {
  const token = await getAgencyToken(store);
  return ghlFetch<any>(`/locations/${locationId}`, token, {
    method: "PUT",
    body: { companyId: store.companyId, snapshot: { id: snapshotId, override } },
  });
}

export async function snapshotPushStatus(store: CompanyStore, snapshotId: string, locationId: string): Promise<string | null> {
  const token = await getAgencyToken(store);
  const data = await ghlFetch<any>(`/snapshots/snapshot-status/${snapshotId}/location/${locationId}`, token);
  const rows: any[] = Array.isArray(data.data) ? data.data : data.data ? [data.data] : [];
  if (!rows.length) return null;
  rows.sort((a, b) => String(b.dateAdded ?? "").localeCompare(String(a.dateAdded ?? "")));
  return String(rows[0].status ?? "").toLowerCase() || null;
}
