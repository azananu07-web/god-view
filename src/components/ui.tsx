"use client";
import { AlertTriangle, CheckCircle2, CircleAlert, ArrowUpRight, ArrowDownRight, XCircle } from "lucide-react";
import type { AccountStatus } from "@/lib/types";

export function StatusPill({ status, streak }: { status: AccountStatus; streak?: number }) {
  if (status === "churn")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-critical px-2 py-0.5 text-[11px] font-semibold text-white whitespace-nowrap">
        <CircleAlert className="w-3 h-3" /> Churn risk{streak ? ` · ${streak}d` : ""}
      </span>
    );
  if (status === "watch")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warn px-2 py-0.5 text-[11px] font-semibold text-[#0b0b0b] whitespace-nowrap">
        <AlertTriangle className="w-3 h-3" /> Watch{streak ? ` · ${streak}d low` : ""}
      </span>
    );
  if (status === "error")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] font-medium text-ink-2 whitespace-nowrap">
        <XCircle className="w-3 h-3" /> No data
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--good-text)] whitespace-nowrap">
      <CheckCircle2 className="w-3 h-3" /> Healthy
    </span>
  );
}

/** Change vs previous period. `goodWhenUp=false` for metrics like CPL. */
export function Delta({ value, goodWhenUp = true }: { value: number | null; goodWhenUp?: boolean }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-ink-3 text-xs">—</span>;
  const up = value >= 0;
  const good = up === goodWhenUp;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center text-xs font-medium tnum ${Math.abs(value) < 0.005 ? "text-ink-3" : good ? "text-[var(--good-text)]" : "text-[var(--critical-text)]"}`}>
      <Icon className="w-3 h-3" />
      {Math.abs(value * 100).toFixed(Math.abs(value) < 0.1 ? 1 : 0)}%
    </span>
  );
}

export function Sparkline({ values, threshold, width = 96, height = 24 }: { values: number[]; threshold?: number; width?: number; height?: number }) {
  const max = Math.max(1, ...values, threshold ?? 0);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const y = (v: number) => height - 2 - (v / max) * (height - 4);
  const d = values.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = values[values.length - 1] ?? 0;
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      {threshold != null && <line x1={0} x2={width} y1={y(threshold)} y2={y(threshold)} stroke="var(--axis)" strokeDasharray="2 2" />}
      <path d={d} fill="none" stroke="var(--series-1)" strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={(values.length - 1) * step} cy={y(last)} r={2.5} fill={threshold != null && last < threshold ? "#d03b3b" : "var(--series-1)"} />
    </svg>
  );
}

export function ChartTooltip({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: p.color ?? p.fill }} />
          <span className="text-ink-2">{p.name}</span>
          <span className="ml-auto pl-3 font-semibold tnum">{fmt ? fmt(p.value, p.dataKey) : p.value}</span>
        </div>
      ))}
    </div>
  );
}
