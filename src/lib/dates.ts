export const AGENCY_TZ = process.env.AGENCY_TIMEZONE || "UTC";

const fmtCache = new Map<string, Intl.DateTimeFormat>();
export function dayKey(d: Date | string | number, tz = AGENCY_TZ): string {
  let f = fmtCache.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    } catch {
      f = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" });
    }
    fmtCache.set(tz, f);
  }
  return f.format(new Date(d));
}

/** The last `n` day keys ending at `endOffset` days ago (0 = today), oldest first. */
export function lastDays(n: number, endOffset = 0, tz = AGENCY_TZ): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = n - 1 + endOffset; i >= endOffset; i--) out.push(dayKey(now - i * 86400_000, tz));
  return out;
}
