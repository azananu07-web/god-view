"use client";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { X, Rocket, Wrench, Save } from "lucide-react";
import type { AccountMetrics } from "@/lib/types";
import { METRICS, MetricKey, change, money, num, pct, relTime, shortDate } from "@/lib/format";
import { ChartTooltip, Delta, StatusPill } from "./ui";

type Props = {
  account: AccountMetrics;
  rank: number | undefined;
  total: number;
  metric: MetricKey;
  mode: "live" | "demo";
  onClose: () => void;
  onPushFrom: () => void;
  onFix: () => void;
  onSaved: () => void;
};

export default function AccountDrawer({ account: a, rank, total, metric, onClose, onPushFrom, onFix, onSaved }: Props) {
  const [spend, setSpend] = useState(a.dailySpendOverride?.toString() ?? "");
  const [thr, setThr] = useState(a.churnThresholdOverride?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setSpend(a.dailySpendOverride?.toString() ?? "");
    setThr(a.churnThresholdOverride?.toString() ?? "");
  }, [a.id, a.dailySpendOverride, a.churnThresholdOverride]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const rows = a.series.map((s) => ({ ...s, label: shortDate(s.date) }));
  const interval = Math.max(0, Math.ceil(rows.length / 7) - 1);

  async function save() {
    setSaving(true);
    await fetch(`/api/accounts/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailySpendOverride: spend === "" ? null : Number(spend), churnThresholdOverride: thr === "" ? null : Number(thr) }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end anim-fade" role="dialog" aria-modal="true" aria-label={a.name}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative h-full w-full max-w-[620px] bg-[var(--plane)] border-l border-[var(--border)] overflow-y-auto anim-slide">
        <header className="sticky top-0 z-10 bg-[var(--plane)] border-b border-[var(--border)] px-5 py-4 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold leading-tight truncate">{a.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
              {a.location && <span>{a.location}</span>}
              <StatusPill status={a.status} streak={a.status !== "healthy" ? a.lowStreak : undefined} />
              {rank != null && <span>#{rank} of {total} by {METRICS[metric].short}</span>}
              <span>Synced {relTime(a.lastSyncedAt)}</span>
            </div>
          </div>
          <button className="btn !p-1.5" onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
        </header>

        <div className="p-5 space-y-4">
          {a.syncError && <div className="rounded-lg border border-serious/50 px-3 py-2 text-sm text-ink-2">⚠ {a.syncError}</div>}
          {a.status === "churn" && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--critical-wash)", color: "var(--critical-text)" }}>
              Lead volume has been under <b>{a.threshold}/day</b> for <b>{a.lowStreak} consecutive days</b>. Consider pushing a proven funnel here.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={onPushFrom}><Rocket className="w-4 h-4" /> Push this account’s snapshot to others</button>
            <button className="btn" onClick={onFix}><Wrench className="w-4 h-4" /> Push a winner into this account</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ["Leads", num(a.leads), change(a.leads, a.leadsPrev), true],
              ["CPL", money(a.cpl, 2), change(a.cpl, a.cplPrev), false],
              ["Show rate", pct(a.showRate), change(a.showRate, a.showRatePrev), true],
              ["Revenue", money(a.revenue), change(a.revenue, a.revenuePrev), true],
            ].map(([l, v, d, up]) => (
              <div key={l as string} className="card p-3">
                <div className="text-xs text-ink-2">{l as string}</div>
                <div className="text-lg font-semibold">{v as string}</div>
                <Delta value={d as number | null} goodWhenUp={up as boolean} />
              </div>
            ))}
          </div>

          <section className="card p-4">
            <div className="text-sm font-semibold">Daily leads</div>
            <div className="text-xs text-ink-3">Dashed line = churn threshold ({a.threshold}/day)</div>
            <div className="h-48 mt-2">
              <ResponsiveContainer>
                <BarChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap={2}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--axis)" }} interval={interval} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTooltip />} />
                  <ReferenceLine y={a.threshold} stroke="#d03b3b" strokeDasharray="4 3" />
                  <Bar dataKey="leads" name="Leads" radius={[4, 4, 0, 0]}>
                    {rows.map((r) => <Cell key={r.date} fill={r.leads < a.threshold ? "#d03b3b" : "var(--series-1)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex gap-4 text-xs text-ink-2">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--series-1)]" /> At/above threshold</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-critical" /> Below threshold</span>
            </div>
          </section>

          <section className="card p-4">
            <div className="text-sm font-semibold">Appointments</div>
            <div className="text-xs text-ink-3">{num(a.booked)} booked · {num(a.showed)} showed · {num(a.noShow)} no-show</div>
            <div className="h-44 mt-2">
              <ResponsiveContainer>
                <BarChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap={2}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--axis)" }} interval={interval} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTooltip />} />
                  <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
                  <Bar dataKey="showed" name="Showed" stackId="a" fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={1} />
                  <Bar dataKey="noShow" name="No-show" stackId="a" fill="var(--series-2)" stroke="var(--surface-1)" strokeWidth={1} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card p-4">
            <div className="text-sm font-semibold">Revenue won</div>
            <div className="h-40 mt-2">
              <ResponsiveContainer>
                <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--axis)" }} interval={interval} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => "$" + (v >= 1000 ? Math.round(v / 1000) + "k" : v)} />
                  <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTooltip fmt={(v: number) => money(v)} />} />
                  <Bar dataKey="revenue" name="Revenue" fill="var(--series-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card p-4">
            <div className="text-sm font-semibold">Overrides for this sub-account</div>
            <div className="mt-3 grid sm:grid-cols-2 gap-3">
              <label className="text-xs text-ink-2">
                Daily ad spend ($)
                <input className="input w-full mt-1" inputMode="decimal" placeholder="Use synced value" value={spend} onChange={(e) => setSpend(e.target.value.replace(/[^\d.]/g, ""))} />
              </label>
              <label className="text-xs text-ink-2">
                Churn threshold (leads/day)
                <input className="input w-full mt-1" inputMode="numeric" placeholder="Use agency default" value={thr} onChange={(e) => setThr(e.target.value.replace(/\D/g, ""))} />
              </label>
            </div>
            <button className="btn mt-3" onClick={save} disabled={saving}><Save className="w-4 h-4" /> {saving ? "Saving…" : "Save overrides"}</button>
          </section>
        </div>
      </aside>
    </div>
  );
}
