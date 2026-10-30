"use client";
import { useState } from "react";
import type { AccountMetrics } from "@/lib/types";
import { shortDate } from "@/lib/format";
import { StatusPill } from "./ui";

const BUCKETS = [0, 1, 3, 6, 11, 21]; // lower bounds → --seq-1..6
function seqVar(v: number) {
  if (v <= 0) return "var(--seq-0)";
  let i = 0;
  while (i + 1 < BUCKETS.length && v >= BUCKETS[i + 1]) i++;
  return `var(--seq-${i + 1})`;
}

type Tip = { x: number; y: number; name: string; date: string; leads: number; threshold: number } | null;

/** Lead-volume heatmap for accounts trending toward churn – last 14 completed days. */
export default function ChurnRadar({ accounts, churnDays, onOpen }: { accounts: AccountMetrics[]; churnDays: number; onOpen: (id: string) => void }) {
  const [tip, setTip] = useState<Tip>(null);
  const flagged = accounts
    .filter((a) => a.status === "churn" || a.status === "watch")
    .sort((a, b) => b.lowStreak - a.lowStreak || a.leads - b.leads);

  if (!flagged.length)
    return <div className="px-4 py-8 text-sm text-ink-3 text-center">No sub-accounts are below their lead threshold. 🎉</div>;

  // Completed days only (drop today), last 14.
  const days = flagged[0].series.slice(0, -1).slice(-14).map((s) => s.date);

  return (
    <div className="relative px-4 pb-4">
      <div className="overflow-x-auto">
        <table className="text-xs border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className="text-left font-medium text-ink-2 pr-3 min-w-[200px]">Sub-account</th>
              {days.map((d, i) => (
                <th key={d} className="font-normal text-ink-3 w-7 tnum">{i % 2 === days.length % 2 ? "" : shortDate(d).split(" ")[1]}</th>
              ))}
              <th className="pl-3 text-left font-medium text-ink-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {flagged.map((a) => {
              const byDate = new Map(a.series.map((s) => [s.date, s.leads]));
              return (
                <tr key={a.id} className="cursor-pointer" onClick={() => onOpen(a.id)}>
                  <td className="pr-3 py-0.5 font-medium truncate max-w-[240px] hover:underline">{a.name}</td>
                  {days.map((d) => {
                    const v = byDate.get(d) ?? 0;
                    const low = v < a.threshold;
                    return (
                      <td
                        key={d}
                        className="w-7 h-7 rounded-[4px] text-center align-middle tnum"
                        style={{
                          background: seqVar(v),
                          boxShadow: low ? "inset 0 0 0 2px #d03b3b" : undefined,
                          color: v >= 11 ? "var(--seq-hi-ink)" : "var(--text-secondary)",
                        }}
                        onMouseEnter={(e) => {
                          const r = (e.target as HTMLElement).getBoundingClientRect();
                          const p = (e.currentTarget.closest(".relative") as HTMLElement).getBoundingClientRect();
                          setTip({ x: r.left - p.left + r.width / 2, y: r.top - p.top, name: a.name, date: d, leads: v, threshold: a.threshold });
                        }}
                        onMouseLeave={() => setTip(null)}
                        aria-label={`${a.name} ${d}: ${v} leads${low ? ", below threshold" : ""}`}
                      >
                        {v}
                      </td>
                    );
                  })}
                  <td className="pl-3"><StatusPill status={a.status} streak={a.lowStreak} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1">Leads/day
          {[0, 1, 3, 6, 11, 21].map((b) => <span key={b} className="inline-block w-4 h-3 rounded-sm" style={{ background: seqVar(b) }} title={`${b}+`} />)}
          <span className="text-ink-3">0 → 21+</span>
        </span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-3 rounded-sm" style={{ boxShadow: "inset 0 0 0 2px #d03b3b" }} /> Below threshold</span>
        <span className="text-ink-3">Red after {churnDays} consecutive low days</span>
      </div>
      {tip && (
        <div className="pointer-events-none absolute z-20 card px-3 py-2 text-xs shadow-lg -translate-x-1/2 -translate-y-full" style={{ left: tip.x, top: tip.y - 6 }}>
          <div className="font-semibold">{tip.name}</div>
          <div className="text-ink-2">{shortDate(tip.date)} · <span className="tnum font-semibold text-ink">{tip.leads}</span> leads</div>
          <div className={tip.leads < tip.threshold ? "text-[var(--critical-text)]" : "text-ink-3"}>Threshold {tip.threshold}/day</div>
        </div>
      )}
    </div>
  );
}
