import type { AccountMetrics, AccountStatus, CompanyStore, DailyMetric, DashboardPayload } from "./types";
import { lastDays } from "./dates";

const ZERO = (date: string): DailyMetric => ({ date, leads: 0, booked: 0, showed: 0, noShow: 0, revenue: 0, spend: 0 });

function sum(rows: DailyMetric[]) {
  return rows.reduce(
    (a, r) => ({ leads: a.leads + r.leads, booked: a.booked + r.booked, showed: a.showed + r.showed, noShow: a.noShow + r.noShow, revenue: a.revenue + r.revenue, spend: a.spend + r.spend }),
    { leads: 0, booked: 0, showed: 0, noShow: 0, revenue: 0, spend: 0 },
  );
}
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

export function computeDashboard(store: CompanyStore, days: number): DashboardPayload {
  const { settings } = store;
  const range = lastDays(days);
  const prevRange = lastDays(days, days);
  // Churn is judged on completed days only – today is still in progress.
  const churnWindow = lastDays(30, 1).reverse(); // yesterday first

  const daily = new Map(range.map((d) => [d, { date: d, leads: 0, revenue: 0, showed: 0, noShow: 0 }]));
  const accounts: AccountMetrics[] = Object.values(store.accounts).map((acc) => {
    const byDate = new Map(acc.daily.map((d) => [d.date, d]));
    const withSpend = (d: DailyMetric) => (acc.dailySpendOverride != null ? { ...d, spend: acc.dailySpendOverride } : d);
    const series = range.map((d) => withSpend(byDate.get(d) ?? ZERO(d)));
    const prev = prevRange.map((d) => withSpend(byDate.get(d) ?? ZERO(d)));
    const cur = sum(series);
    const p = sum(prev);

    for (const s of series) {
      const agg = daily.get(s.date)!;
      agg.leads += s.leads; agg.revenue += s.revenue; agg.showed += s.showed; agg.noShow += s.noShow;
    }

    const threshold = acc.churnThresholdOverride ?? settings.churnThreshold;
    let lowStreak = 0;
    for (const d of churnWindow) {
      if ((byDate.get(d)?.leads ?? 0) < threshold) lowStreak++;
      else break;
    }
    const hasData = acc.daily.length > 0;
    const status: AccountStatus = acc.syncError && !hasData ? "error" : lowStreak >= settings.churnDays ? "churn" : lowStreak > 0 ? "watch" : "healthy";

    return {
      id: acc.id,
      name: acc.name,
      location: [acc.city, acc.state].filter(Boolean).join(", "),
      status,
      lowStreak,
      threshold,
      leads: cur.leads,
      spend: cur.spend,
      cpl: cur.spend > 0 ? ratio(cur.spend, cur.leads) : null,
      booked: cur.booked,
      showed: cur.showed,
      noShow: cur.noShow,
      showRate: ratio(cur.showed, cur.showed + cur.noShow),
      revenue: cur.revenue,
      leadsPrev: p.leads,
      revenuePrev: p.revenue,
      cplPrev: p.spend > 0 ? ratio(p.spend, p.leads) : null,
      showRatePrev: ratio(p.showed, p.showed + p.noShow),
      series,
      syncError: acc.syncError,
      lastSyncedAt: acc.lastSyncedAt,
      dailySpendOverride: acc.dailySpendOverride,
      churnThresholdOverride: acc.churnThresholdOverride,
    };
  });

  const t = accounts.reduce(
    (a, m) => {
      a.leads += m.leads; a.revenue += m.revenue; a.showed += m.showed; a.noShow += m.noShow;
      a.leadsPrev += m.leadsPrev; a.revenuePrev += m.revenuePrev;
      if (m.spend > 0) { a.spend += m.spend; a.paidLeads += m.leads; }
      return a;
    },
    { leads: 0, revenue: 0, showed: 0, noShow: 0, leadsPrev: 0, revenuePrev: 0, spend: 0, paidLeads: 0 },
  );
  const prevAgg = Object.values(store.accounts).reduce(
    (a, acc) => {
      const byDate = new Map(acc.daily.map((d) => [d.date, d]));
      for (const d of prevRange) {
        const r = byDate.get(d);
        if (!r) continue;
        const spend = acc.dailySpendOverride ?? r.spend;
        a.showed += r.showed; a.noShow += r.noShow;
        if (spend > 0) { a.spend += spend; a.leads += r.leads; }
      }
      return a;
    },
    { showed: 0, noShow: 0, spend: 0, leads: 0 },
  );

  return {
    mode: store.mode,
    companyName: store.companyName ?? "Your agency",
    days,
    dates: range,
    settings,
    sync: store.sync,
    accounts,
    totals: {
      accounts: accounts.length,
      leads: t.leads,
      spend: t.spend,
      cpl: ratio(t.spend, t.paidLeads),
      showRate: ratio(t.showed, t.showed + t.noShow),
      revenue: t.revenue,
      churn: accounts.filter((a) => a.status === "churn").length,
      watch: accounts.filter((a) => a.status === "watch").length,
      leadsPrev: t.leadsPrev,
      revenuePrev: t.revenuePrev,
      cplPrev: ratio(prevAgg.spend, prevAgg.leads),
      showRatePrev: ratio(prevAgg.showed, prevAgg.showed + prevAgg.noShow),
    },
    daily: [...daily.values()],
  };
}
