import type { CompanyStore } from "../types";
import { saveStore } from "../store";

export const GHL_API = process.env.GHL_API_BASE || "https://services.leadconnectorhq.com";
export const GHL_VERSION = "2021-07-28";

export class GhlError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

type FetchOpts = {
  method?: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  form?: Record<string, string>;
  version?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Low-level call with retry on 429 / 5xx (GHL allows ~100 req / 10s per location). */
export async function ghlFetch<T = any>(path: string, token: string | null, opts: FetchOpts = {}): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : GHL_API + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));

  const headers: Record<string, string> = { Accept: "application/json", Version: opts.version ?? GHL_VERSION };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: string | undefined;
  if (opts.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(opts.form).toString();
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { method: opts.method ?? (body ? "POST" : "GET"), headers, body, cache: "no-store" });
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt + Math.random() * 250);
      continue;
    }
    const text = await res.text();
    let data: any = text;
    try { data = text ? JSON.parse(text) : {}; } catch { /* keep text */ }
    if (!res.ok) {
      const msg = (typeof data === "object" && (data.message || data.error_description || data.error)) || res.statusText;
      throw new GhlError(res.status, `GHL ${res.status} ${path}: ${Array.isArray(msg) ? msg.join(", ") : msg}`, data);
    }
    return data as T;
  }
}

// ---------- token management ----------

const refreshing = new Map<string, Promise<string>>();

/** Returns a valid agency (Company) access token, refreshing and persisting it if needed. */
export async function getAgencyToken(store: CompanyStore): Promise<string> {
  const auth = store.auth;
  if (!auth) throw new GhlError(401, "Not connected to HighLevel");
  if (auth.expiresAt - 120_000 > Date.now()) return auth.accessToken;

  // Refresh tokens are single-use: make sure concurrent callers share one refresh.
  let p = refreshing.get(store.companyId);
  if (!p) {
    p = (async () => {
      const data = await ghlFetch<any>("/oauth/token", null, {
        form: {
          client_id: process.env.GHL_CLIENT_ID!,
          client_secret: process.env.GHL_CLIENT_SECRET!,
          grant_type: "refresh_token",
          refresh_token: auth.refreshToken,
          user_type: "Company",
        },
      });
      store.auth = {
        ...auth,
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? auth.refreshToken,
        expiresAt: Date.now() + (data.expires_in ?? 86399) * 1000,
      };
      await saveStore(store);
      return store.auth.accessToken;
    })().finally(() => refreshing.delete(store.companyId));
    refreshing.set(store.companyId, p);
  }
  return p;
}

const minting = new Map<string, Promise<string>>();

/** Exchanges the agency token for a sub-account (Location) token. Cached until near expiry. */
export async function getLocationToken(store: CompanyStore, locationId: string): Promise<string> {
  const cached = store.locationTokens[locationId];
  if (cached && cached.expiresAt - 120_000 > Date.now()) return cached.token;
  // Parallel fetchers for the same location share one exchange.
  const key = `${store.companyId}:${locationId}`;
  let p = minting.get(key);
  if (!p) {
    p = (async () => {
      const agency = await getAgencyToken(store);
      const data = await ghlFetch<any>("/oauth/locationToken", agency, {
        form: { companyId: store.companyId, locationId },
      });
      store.locationTokens[locationId] = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in ?? 86399) * 1000,
      };
      return data.access_token as string;
    })().finally(() => minting.delete(key));
    minting.set(key, p);
  }
  return p;
}
