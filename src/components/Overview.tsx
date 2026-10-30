"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from "recharts";
import type { DashboardPayload } from "@/lib/types";
import { change, compactMoney, money, num, pct, shortDate } from "@/lib/format";
import { ChartTooltip, Delta } from "./ui";
import { CircleAlert } from "lucide-react";

export function KpiTiles({ data, onChurnClick }: { data: DashboardPayload; onChurnClick: () => void }) {
  const t = data.totals;
  const tiles = [
    { label: "Revenue (won)", value: compactMoney(t.revenue), delta: change(t.revenue, t.revenuePrev), up: true },
    { label: "Leads", value: num(t.leads), delta: change(t.leads, t.leadsPrev), up: true },
    { label: "Blended CPL", value: money(t.cpl, 2), delta: change(t.cpl, t.cplPrev), up: false },
    { label: "Show rate", value: pct(t.showRate), delta: change(t.showRate, t.showRatePrev), up: true },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {tiles.map((k) => (
        <div key={k.label} className="card p-4">
          <div className="text-xs font-medium text-ink-2">{k.label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{k.value}</div>
          <div className="mt-1 flex items-center gap-1 text-xs text-ink-3">
            <Delta value={k.delta} goodWhenUp={k.up} /> vs prev {data.days}d
          </div>
        </div>
      ))}
      <button onClick={onChurnClick} className="card p-4 text-left col-span-2 lg:col-span-1 hover:bg-[var(--surface-2)] transition-colors" style={t.churn ? { background: "var(--critical-wash)", borderColor: "rgba(208,59,59,.4)" } : undefined}>
        <div className="text-xs font-medium text-ink-2 flex items-center gap-1">
          <CircleAlert className="w-3.5 h-3.5 text-critical" /> Churn risk
        </div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">
          {t.churn} <span className="text-base font-normal text-ink-2">of {t.accounts}</span>
        </div>
        <div className="mt-1 text-xs text-ink-3">{t.watch} more on watch · click to filter</div>
      </button>
    </div>
  );
}

export function AgencyTrend({ data }: { data: DashboardPayload }) {
  const rows = data.daily.map((d) => ({ ...d, label: shortDate(d.date) }));
  const interval = Math.max(0, Math.ceil(rows.length / 8) - 1);
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <div className="card p-4">
        <div className="text-sm font-semibold">Leads per day · all sub-accounts</div>
        <div className="h-44 mt-2">
          <ResponsiveContainer>
            <BarChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--axis)" }} interval={interval} />
              <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => v.toLocaleString("en-US")} />
              <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTooltip />} />
              <Bar dataKey="leads" name="Leads" fill="var(--series-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card p-4">
        <div className="text-sm font-semibold">Revenue won per day</div>
        <div className="h-44 mt-2">
          <ResponsiveContainer>
            <AreaChart data={rows} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--axis)" }} interval={interval} />
              <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v) => compactMoney(v)} />
              <Tooltip cursor={{ stroke: "var(--axis)" }} content={<ChartTooltip fmt={(v: number) => money(v)} />} />
              <Area dataKey="revenue" name="Revenue" stroke="var(--series-1)" strokeWidth={2} fill="url(#revFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
