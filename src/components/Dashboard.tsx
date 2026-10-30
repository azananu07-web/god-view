"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Rocket, X, Trophy, Siren, Download } from "lucide-react";
import type { DashboardPayload, PushJob } from "@/lib/types";
import { METRICS, MetricKey, bottomQuartile, rankBy } from "@/lib/format";
import Header from "./Header";
import { KpiTiles, AgencyTrend } from "./Overview";
import Leaderboard from "./Leaderboard";
import ChurnRadar from "./ChurnRadar";
import AccountDrawer from "./AccountDrawer";
import PushModal from "./PushModal";
import JobsPanel, { jobActive } from "./JobsPanel";

type StatusFilter = "all" | "churn" | "watch" | "healthy";
type PushState = { sourceId?: string; targets: string[] } | null;

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState<MetricKey>("cpl");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerId, setDrawerId] = useState<string>();
  const [push, setPush] = useState<PushState>(null);
  const [jobs, setJobs] = useState<PushJob[]>([]);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [toast, setToast] = useState<string>();
  const [limit, setLimit] = useState(25);

  // Restore per-viewer view preferences.
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem("gv-view") || "{}");
      if (p.days) setDays(p.days);
      if (p.metric && p.metric in METRICS) setMetric(p.metric);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("gv-view", JSON.stringify({ days, metric })); } catch {}
  }, [days, metric]);

  const load = useCallback(async () => {
    const r = await fetch(`/api/dashboard?days=${days}`, { cache: "no-store" });
    if (r.status === 401) return void (window.location.href = "/");
    if (!r.ok) return setError("Failed to load dashboard");
    setData(await r.json());
    setError(undefined);
  }, [days]);
  useEffect(() => { void load(); }, [load]);

  const loadJobs = useCallback(async () => {
    const r = await fetch("/api/snapshots/jobs", { cache: "no-store" });
    if (r.ok) setJobs((await r.json()).jobs);
  }, []);
  useEffect(() => { void loadJobs(); }, [loadJobs]);

  // Poll while a sync or push is in flight.
  const syncing = data?.sync.running;
  useEffect(() => {
    if (!syncing) return;
    const t = setInterval(async () => {
      const r = await fetch("/api/sync", { cache: "no-store" });
      if (!r.ok) return;
      const s = await r.json();
      setData((d) => (d ? { ...d, sync: s } : d));
      if (!s.running) { void load(); setToast(s.message ?? "Sync complete"); }
    }, 1200);
    return () => clearInterval(t);
  }, [syncing, load]);
  const activeJobs = jobs.filter(jobActive).length;
  useEffect(() => {
    if (!activeJobs) return;
    const t = setInterval(loadJobs, 2000);
    return () => clearInterval(t);
  }, [activeJobs, loadJobs]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const startSync = async () => {
    const r = await fetch("/api/sync", { method: "POST" });
    const s = await r.json();
    setData((d) => (d ? { ...d, sync: s } : d));
  };

  const ranked = useMemo(() => (data ? rankBy(data.accounts, metric) : []), [data, metric]);
  const rankOf = useMemo(() => new Map(ranked.map((a, i) => [a.id, i + 1])), [ranked]);
  const filtered = useMemo(
    () => ranked.filter((a) => (status === "all" || a.status === status) && (!q || a.name.toLowerCase().includes(q.toLowerCase()) || a.location.toLowerCase().includes(q.toLowerCase()))),
    [ranked, status, q],
  );
  const drawerAccount = data?.accounts.find((a) => a.id === drawerId);

  const openPushFrom = (sourceId: string) => {
    if (!data) return;
    const defaults = new Set([...data.accounts.filter((a) => a.status === "churn").map((a) => a.id), ...bottomQuartile(data.accounts, metric).map((a) => a.id)]);
    const fromSelection = [...selected].filter((id) => id !== sourceId);
    setPush({ sourceId, targets: fromSelection.length ? fromSelection : [...defaults] });
  };
  const openFix = (targetId: string) => setPush({ sourceId: ranked.find((a) => a.id !== targetId && a.status === "healthy")?.id, targets: [targetId] });

  const exportCsv = () => {
    const head = ["rank", "name", "location", "status", "low_streak", "leads", "spend", "cpl", "booked", "showed", "no_show", "show_rate", "revenue"];
    const lines = filtered.map((a) => [rankOf.get(a.id), a.name, a.location, a.status, a.lowStreak, a.leads, a.spend.toFixed(2), a.cpl?.toFixed(2) ?? "", a.booked, a.showed, a.noShow, a.showRate?.toFixed(3) ?? "", a.revenue].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const el = Object.assign(document.createElement("a"), { href: url, download: `god-view-${metric}-${days}d.csv` });
    el.click();
    URL.revokeObjectURL(url);
  };

  const counts = useMemo(() => {
    const c = { all: 0, churn: 0, watch: 0, healthy: 0 } as Record<StatusFilter, number>;
    for (const a of data?.accounts ?? []) { c.all++; if (a.status in c) c[a.status as StatusFilter]++; }
    return c;
  }, [data]);

  return (
    <>
      <Header page="dashboard" companyName={data?.companyName} mode={data?.mode} sync={data?.sync} onSync={startSync} activeJobs={activeJobs} onJobs={() => setJobsOpen(true)} />
      <main className="max-w-[1500px] mx-auto px-4 py-5 space-y-4">
        {error && <div className="card p-4 text-[var(--critical-text)]">{error}</div>}
        {!data && !error && <Skeleton />}
        {data && data.accounts.length === 0 && (
          <div className="card p-10 text-center">
            <div className="text-lg font-semibold">{data.sync.running ? "Pulling your sub-accounts from HighLevel…" : "No sub-accounts yet"}</div>
            <div className="text-sm text-ink-2 mt-1">{data.sync.running ? `${data.sync.done}/${data.sync.total || "?"} synced` : data.sync.message ?? "Run a sync to load pipeline, appointment and lead data."}</div>
            {!data.sync.running && <button className="btn btn-primary mt-4" onClick={startSync}>Sync now</button>}
          </div>
        )}
        {data && data.accounts.length > 0 && (
          <>
            {/* Filters: one row, above everything they control */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="seg" role="group" aria-label="Date range">
                {[7, 14, 30, 60].map((d) => (
                  <button key={d} aria-pressed={days === d} onClick={() => setDays(d)}>{d}d</button>
                ))}
              </div>
              <div className="seg" role="group" aria-label="Status filter">
                {(["all", "churn", "watch", "healthy"] as StatusFilter[]).map((s) => (
                  <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)} className="capitalize">
                    {s === "churn" ? "Churn risk" : s} <span className="text-ink-3 tnum">{counts[s]}</span>
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-ink-3" />
                <input className="input w-full !pl-8" placeholder="Search sub-accounts…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>

            <KpiTiles data={data} onChurnClick={() => { setStatus("churn"); document.getElementById("leaderboard")?.scrollIntoView({ behavior: "smooth" }); }} />
            <AgencyTrend data={data} />

            <section id="leaderboard" className="card overflow-hidden">
              <div className="px-4 pt-4 pb-3 flex flex-wrap items-center gap-3 border-b border-[var(--border)]">
                <Trophy className="w-5 h-5 text-brand" />
                <div className="flex-1 min-w-[200px]">
                  <h2 className="font-semibold">Global leaderboard</h2>
                  <div className="text-xs text-ink-3">Ranked by {METRICS[metric].label.toLowerCase()} · last {days} days · change vs previous {days} days</div>
                </div>
                <div className="seg" role="group" aria-label="Rank by">
                  {(Object.keys(METRICS) as MetricKey[]).map((m) => (
                    <button key={m} aria-pressed={metric === m} onClick={() => setMetric(m)}>{METRICS[m].short}</button>
                  ))}
                </div>
                <button className="btn !p-2" onClick={exportCsv} aria-label="Export CSV" title="Export CSV"><Download className="w-4 h-4" /></button>
              </div>

              {selected.size > 0 && (
                <div className="px-4 py-2 flex items-center gap-3 text-sm bg-[var(--surface-2)] border-b border-[var(--border)]">
                  <b>{selected.size}</b> selected
                  <button className="btn btn-primary !py-1" onClick={() => setPush({ sourceId: ranked.find((a) => !selected.has(a.id))?.id, targets: [...selected] })}>
                    <Rocket className="w-4 h-4" /> Push a snapshot to selected
                  </button>
                  <button className="btn !py-1" onClick={() => setSelected(new Set())}><X className="w-4 h-4" /> Clear</button>
                </div>
              )}

              <Leaderboard
                rows={filtered.slice(0, limit)}
                rankOf={rankOf}
                metric={metric}
                onMetric={setMetric}
                selected={selected}
                onToggle={(id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })}
                onToggleAll={(ids, on) => setSelected((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; })}
                onOpen={setDrawerId}
                onPushFrom={openPushFrom}
              />
              {filtered.length > limit && (
                <div className="p-3 text-center border-t border-[var(--border)]">
                  <button className="btn" onClick={() => setLimit((l) => l + 50)}>Show more ({filtered.length - limit} remaining)</button>
                </div>
              )}
            </section>

            <section className="card overflow-hidden">
              <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                <Siren className="w-5 h-5 text-critical" />
                <div>
                  <h2 className="font-semibold">Churn predictor</h2>
                  <div className="text-xs text-ink-3">
                    Sub-accounts under their lead threshold (default {data.settings.churnThreshold}/day) on recent completed days. {data.settings.churnDays}+ consecutive days = red.
                  </div>
                </div>
              </div>
              <ChurnRadar accounts={data.accounts} churnDays={data.settings.churnDays} onOpen={setDrawerId} />
            </section>
          </>
        )}
      </main>

      {drawerAccount && data && (
        <AccountDrawer
          account={drawerAccount}
          rank={METRICS[metric].get(drawerAccount) != null ? rankOf.get(drawerAccount.id) : undefined}
          total={data.accounts.length}
          metric={metric}
          mode={data.mode}
          onClose={() => setDrawerId(undefined)}
          onPushFrom={() => openPushFrom(drawerAccount.id)}
          onFix={() => openFix(drawerAccount.id)}
          onSaved={() => { void load(); setToast("Overrides saved"); }}
        />
      )}
      {push && data && (
        <PushModal
          accounts={data.accounts}
          metric={metric}
          sourceId={push.sourceId}
          initialTargets={push.targets}
          mode={data.mode}
          onClose={() => setPush(null)}
          onPushed={(n) => { setPush(null); setDrawerId(undefined); setSelected(new Set()); setToast(`Snapshot push started for ${n} sub-account${n === 1 ? "" : "s"}`); void loadJobs(); setJobsOpen(true); }}
        />
      )}
      {jobsOpen && <JobsPanel jobs={jobs} onClose={() => setJobsOpen(false)} />}
      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] card px-4 py-2.5 text-sm shadow-xl anim-fade">{toast}</div>
      )}
    </>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="card h-24" />)}</div>
      <div className="grid lg:grid-cols-2 gap-3"><div className="card h-56" /><div className="card h-56" /></div>
      <div className="card h-96" />
    </div>
  );
}
