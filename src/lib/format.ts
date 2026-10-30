import type { AccountMetrics } from "./types";

export const money = (n: number | null | undefined, digits = 0) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits });
export const compactMoney = (n: number | null | undefined) =>
  n == null ? "—" : n >= 1000 ? "$" + Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n) : money(n);
export const num = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US"));
export const pct = (n: number | null | undefined, digits = 0) => (n == null ? "—" : (n * 100).toFixed(digits) + "%");
export const shortDate = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const relTime = (iso?: string) => {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

/** Relative change, or null when there's no baseline. */
export const change = (cur: number | null, prev: number | null) => (cur == null || prev == null || prev === 0 ? null : (cur - prev) / prev);

export type MetricKey = "cpl" | "showRate" | "revenue" | "leads";
export const METRICS: Record<MetricKey, { label: string; short: string; dir: "asc" | "desc"; get: (a: AccountMetrics) => number | null; fmt: (n: number | null) => string }> = {
  cpl: { label: "Lowest cost per lead", short: "CPL", dir: "asc", get: (a) => a.cpl, fmt: (n) => money(n, 2) },
  showRate: { label: "Highest show rate", short: "Show rate", dir: "desc", get: (a) => a.showRate, fmt: (n) => pct(n) },
  revenue: { label: "Most revenue", short: "Revenue", dir: "desc", get: (a) => a.revenue, fmt: (n) => money(n) },
  leads: { label: "Most leads", short: "Leads", dir: "desc", get: (a) => a.leads, fmt: (n) => num(n) },
};

/** Best-first ranking; accounts with no value for the metric sink to the bottom. */
export function rankBy(accounts: AccountMetrics[], metric: MetricKey): AccountMetrics[] {
  const m = METRICS[metric];
  return [...accounts].sort((a, b) => {
    const va = m.get(a), vb = m.get(b);
    if (va == null && vb == null) return a.name.localeCompare(b.name);
    if (va == null) return 1;
    if (vb == null) return -1;
    return m.dir === "asc" ? va - vb : vb - va;
  });
}

export function bottomQuartile(accounts: AccountMetrics[], metric: MetricKey): AccountMetrics[] {
  const ranked = rankBy(accounts, metric).filter((a) => METRICS[metric].get(a) != null);
  return ranked.slice(Math.floor(ranked.length * 0.75));
}
