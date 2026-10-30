"use client";
import { Medal, Rocket, ChevronUp, ChevronDown, AlertCircle } from "lucide-react";
import type { AccountMetrics } from "@/lib/types";
import { METRICS, MetricKey, change, money, num, pct } from "@/lib/format";
import { Delta, Sparkline, StatusPill } from "./ui";

type Props = {
  rows: AccountMetrics[]; // already ranked + filtered
  rankOf: Map<string, number>;
  metric: MetricKey;
  onMetric: (m: MetricKey) => void;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], on: boolean) => void;
  onOpen: (id: string) => void;
  onPushFrom: (id: string) => void;
};

const MEDAL = ["#eda100", "#898781", "#b8733a"];

export default function Leaderboard({ rows, rankOf, metric, onMetric, selected, onToggle, onToggleAll, onOpen, onPushFrom }: Props) {
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const Th = ({ m, children, className = "" }: { m?: MetricKey; children: React.ReactNode; className?: string }) => {
    const active = m === metric;
    return (
      <th className={`px-3 py-2 text-xs font-medium text-right whitespace-nowrap ${active ? "text-ink" : "text-ink-2"} ${className}`} aria-sort={active ? (METRICS[m!].dir === "asc" ? "ascending" : "descending") : undefined}>
        {m ? (
          <button onClick={() => onMetric(m)} className={`inline-flex items-center gap-0.5 hover:text-ink ${active ? "font-semibold" : ""}`} title={`Rank by ${METRICS[m].label.toLowerCase()}`}>
            {children}
            {active ? METRICS[m].dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" /> : <ChevronDown className="w-3 h-3 opacity-30" />}
          </button>
        ) : children}
      </th>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-[var(--surface-1)] border-b border-[var(--border)]">
          <tr>
            <th className="pl-4 pr-1 py-2 w-8">
              <input type="checkbox" aria-label="Select all visible" checked={allOn} onChange={(e) => onToggleAll(rows.map((r) => r.id), e.target.checked)} className="accent-[#2a78d6]" />
            </th>
            <th className="px-2 py-2 text-xs font-medium text-ink-2 text-left w-10">#</th>
            <th className="px-3 py-2 text-xs font-medium text-ink-2 text-left">Sub-account</th>
            <Th m="leads">Leads</Th>
            <Th>Ad spend</Th>
            <Th m="cpl">CPL</Th>
            <Th m="showRate">Show rate</Th>
            <Th m="revenue">Revenue</Th>
            <th className="px-3 py-2 text-xs font-medium text-ink-2 text-left whitespace-nowrap hidden md:table-cell">Daily leads</th>
            <th className="px-3 py-2 w-24" />
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const rank = rankOf.get(a.id);
            const hasMetric = METRICS[metric].get(a) != null;
            const tint = a.status === "churn" ? "var(--critical-wash)" : a.status === "watch" ? "var(--watch-wash)" : undefined;
            return (
              <tr
                key={a.id}
                onClick={() => onOpen(a.id)}
                className="group border-b border-[var(--border)] cursor-pointer hover:brightness-[0.97] dark:hover:brightness-110"
                style={{ background: tint, boxShadow: a.status === "churn" ? "inset 3px 0 0 #d03b3b" : undefined }}
              >
                <td className="pl-4 pr-1 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label={`Select ${a.name}`} checked={selected.has(a.id)} onChange={() => onToggle(a.id)} className="accent-[#2a78d6]" />
                </td>
                <td className="px-2 py-2.5 tnum text-ink-2">
                  {hasMetric && rank != null && rank <= 3 ? (
                    <span className="inline-flex items-center gap-0.5 font-semibold text-ink"><Medal className="w-4 h-4" style={{ color: MEDAL[rank - 1] }} />{rank}</span>
                  ) : hasMetric ? rank : "–"}
                </td>
                <td className="px-3 py-2.5 min-w-[220px]">
                  <div className="font-medium leading-tight flex items-center gap-1.5">
                    {a.name}
                    {a.syncError && <span title={a.syncError}><AlertCircle className="w-3.5 h-3.5 text-serious" aria-label="Sync error" /></span>}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
                    {a.location && <span>{a.location}</span>}
                    <StatusPill status={a.status} streak={a.status !== "healthy" ? a.lowStreak : undefined} />
                  </div>
                </td>
                <Cell v={num(a.leads)} d={change(a.leads, a.leadsPrev)} active={metric === "leads"} />
                <td className="px-3 py-2.5 text-right tnum text-ink-2">{a.spend ? money(a.spend) : "—"}</td>
                <Cell v={money(a.cpl, 2)} d={change(a.cpl, a.cplPrev)} up={false} active={metric === "cpl"} />
                <Cell v={pct(a.showRate)} d={change(a.showRate, a.showRatePrev)} active={metric === "showRate"} />
                <Cell v={money(a.revenue)} d={change(a.revenue, a.revenuePrev)} active={metric === "revenue"} />
                <td className="px-3 py-2.5 hidden md:table-cell">
                  <Sparkline values={a.series.map((s) => s.leads)} threshold={a.threshold} />
                </td>
                <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <button className="btn !py-1 !px-2 !text-xs opacity-70 group-hover:opacity-100" onClick={() => onPushFrom(a.id)} title="Push this account's winning snapshot to others">
                    <Rocket className="w-3.5 h-3.5" /> Push
                  </button>
                </td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr><td colSpan={10} className="px-4 py-10 text-center text-ink-3">No sub-accounts match these filters.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ v, d, up = true, active }: { v: string; d: number | null; up?: boolean; active: boolean }) {
  return (
    <td className={`px-3 py-2.5 text-right tnum whitespace-nowrap ${active ? "font-semibold" : ""}`}>
      <div>{v}</div>
      <div className="leading-none"><Delta value={d} goodWhenUp={up} /></div>
    </td>
  );
}
