"use client";
import { useEffect, useMemo, useState } from "react";
import { X, Rocket, Search, Sparkles, AlertTriangle, ArrowLeft, Camera } from "lucide-react";
import type { AccountMetrics, Snapshot } from "@/lib/types";
import { METRICS, MetricKey, bottomQuartile } from "@/lib/format";
import { StatusPill } from "./ui";

type Props = {
  accounts: AccountMetrics[];
  metric: MetricKey;
  sourceId?: string;
  initialTargets: string[];
  mode: "live" | "demo";
  onClose: () => void;
  onPushed: (count: number) => void;
};

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);

export default function PushModal({ accounts, metric, sourceId, initialTargets, mode, onClose, onPushed }: Props) {
  const source = accounts.find((a) => a.id === sourceId);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [snapErr, setSnapErr] = useState<string>();
  const [snapQ, setSnapQ] = useState("");
  const [snapshotId, setSnapshotId] = useState<string>();
  const [targets, setTargets] = useState<Set<string>>(new Set(initialTargets.filter((id) => id !== sourceId)));
  const [targetQ, setTargetQ] = useState("");
  const [override, setOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    fetch("/api/snapshots")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setSnapshots(j.snapshots);
      })
      .catch((e) => setSnapErr(e.message));
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  // Snapshots whose name shares words with the source account float to the top.
  const sourceWords = useMemo(() => new Set(source ? words(source.name) : []), [source]);
  const scored = useMemo(() => {
    const list = (snapshots ?? []).filter((s) => s.name.toLowerCase().includes(snapQ.toLowerCase()));
    return list
      .map((s) => ({ s, score: words(s.name).filter((w) => sourceWords.has(w)).length }))
      .sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name));
  }, [snapshots, snapQ, sourceWords]);
  useEffect(() => {
    if (!snapshotId && scored[0]?.score) setSnapshotId(scored[0].s.id);
  }, [scored, snapshotId]);

  const pool = accounts.filter((a) => a.id !== sourceId);
  const churn = pool.filter((a) => a.status === "churn").map((a) => a.id);
  const watch = pool.filter((a) => a.status === "watch").map((a) => a.id);
  const bottom = bottomQuartile(pool, metric).map((a) => a.id);
  const visible = pool.filter((a) => a.name.toLowerCase().includes(targetQ.toLowerCase()));
  const snapshot = snapshots?.find((s) => s.id === snapshotId);

  const toggle = (id: string) => setTargets((t) => { const n = new Set(t); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const addAll = (ids: string[]) => setTargets((t) => new Set([...t, ...ids]));

  async function submit() {
    setSubmitting(true);
    setError(undefined);
    const r = await fetch("/api/snapshots/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshotId, snapshotName: snapshot?.name, sourceLocationId: sourceId, targetIds: [...targets], override }),
    });
    const j = await r.json();
    setSubmitting(false);
    if (!r.ok) return setError(j.error ?? "Push failed");
    onPushed(targets.size);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 anim-fade" role="dialog" aria-modal="true" aria-label="Push snapshot">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col card !bg-[var(--plane)] shadow-2xl">
        <header className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3">
          <Rocket className="w-5 h-5 text-brand" />
          <div className="flex-1">
            <div className="font-semibold">One-click snapshot push</div>
            <div className="text-xs text-ink-3">
              Step {step} of 3 · {step === 1 ? "Choose the winning snapshot" : step === 2 ? "Choose underperforming targets" : "Review & push"}
              {source && <> · winner: <b className="text-ink-2">{source.name}</b></>}
            </div>
          </div>
          <button className="btn !p-1.5" onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 && (
            <>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-ink-3" />
                <input className="input w-full !pl-8" placeholder="Search snapshots…" value={snapQ} onChange={(e) => setSnapQ(e.target.value)} autoFocus />
              </div>
              {snapErr && <div className="mt-3 text-sm text-[var(--critical-text)]">{snapErr}</div>}
              {!snapshots && !snapErr && <div className="mt-6 text-sm text-ink-3">Loading snapshots from HighLevel…</div>}
              <ul className="mt-3 space-y-1.5">
                {scored.map(({ s, score }) => (
                  <li key={s.id}>
                    <label className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer ${snapshotId === s.id ? "border-brand bg-[var(--surface-1)]" : "border-[var(--border)] hover:bg-[var(--surface-1)]"}`}>
                      <input type="radio" name="snap" checked={snapshotId === s.id} onChange={() => setSnapshotId(s.id)} className="accent-[#2a78d6]" />
                      <Camera className="w-4 h-4 text-ink-3 shrink-0" />
                      <span className="flex-1 text-sm">{s.name}</span>
                      {score > 0 && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand"><Sparkles className="w-3 h-3" /> Matches winner</span>}
                      {s.type && <span className="text-[11px] text-ink-3">{s.type}</span>}
                    </label>
                  </li>
                ))}
                {snapshots && !scored.length && <li className="text-sm text-ink-3 py-4">No snapshots found.</li>}
              </ul>
              <p className="mt-4 text-xs text-ink-3 leading-relaxed">
                HighLevel pushes funnels and workflows through snapshots. To push one specific funnel or workflow, create a snapshot in
                <b> Agency → Account Snapshots</b> from {source ? <b>{source.name}</b> : "the winning account"} that includes only those assets, then pick it here.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <button className="btn !py-1 !px-2 !text-xs" onClick={() => addAll(churn)} disabled={!churn.length}>+ Churn risk ({churn.length})</button>
                <button className="btn !py-1 !px-2 !text-xs" onClick={() => addAll(watch)} disabled={!watch.length}>+ Watch list ({watch.length})</button>
                <button className="btn !py-1 !px-2 !text-xs" onClick={() => addAll(bottom)}>+ Bottom 25% by {METRICS[metric].short} ({bottom.length})</button>
                <button className="btn !py-1 !px-2 !text-xs" onClick={() => addAll(visible.map((a) => a.id))}>+ All shown</button>
                <button className="btn !py-1 !px-2 !text-xs" onClick={() => setTargets(new Set())}>Clear</button>
              </div>
              <div className="relative mt-3">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-ink-3" />
                <input className="input w-full !pl-8" placeholder="Search sub-accounts…" value={targetQ} onChange={(e) => setTargetQ(e.target.value)} />
              </div>
              <ul className="mt-2 divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg max-h-[42vh] overflow-y-auto bg-[var(--surface-1)]">
                {visible.map((a) => (
                  <li key={a.id}>
                    <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--surface-2)]">
                      <input type="checkbox" checked={targets.has(a.id)} onChange={() => toggle(a.id)} className="accent-[#2a78d6]" />
                      <span className="flex-1 text-sm truncate">{a.name}</span>
                      <StatusPill status={a.status} />
                      <span className="text-xs tnum text-ink-2 w-20 text-right">{METRICS[metric].fmt(METRICS[metric].get(a))}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-2 text-xs text-ink-2">{targets.size} selected</div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="card p-4 text-sm space-y-1">
                <div><span className="text-ink-3">Snapshot:</span> <b>{snapshot?.name}</b></div>
                {source && <div><span className="text-ink-3">Winner:</span> {source.name}</div>}
                <div><span className="text-ink-3">Targets:</span> <b>{targets.size}</b> sub-account{targets.size === 1 ? "" : "s"}</div>
                <div className="text-xs text-ink-3 pt-1 line-clamp-3">{pool.filter((a) => targets.has(a.id)).map((a) => a.name).join(", ")}</div>
              </div>
              <label className="flex items-start gap-3 card p-4 cursor-pointer">
                <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-1 accent-[#d03b3b]" />
                <span className="text-sm">
                  <b>Override existing assets</b>
                  <span className="block text-xs text-ink-2 mt-0.5">When off, only new funnels/workflows are added and nothing in the target accounts is replaced. When on, assets with the same name are overwritten.</span>
                </span>
              </label>
              {override && (
                <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--critical-wash)", color: "var(--critical-text)" }}>
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> Overwritten assets can’t be restored from here. Make sure clients aren’t mid-campaign.
                </div>
              )}
              {mode === "demo" && <div className="text-xs text-ink-3">Demo mode: the push is simulated, so nothing is sent to HighLevel.</div>}
              {error && <div className="text-sm text-[var(--critical-text)]">{error}</div>}
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-[var(--border)] flex items-center gap-2">
          {step > 1 && <button className="btn" onClick={() => setStep((s) => (s - 1) as 1 | 2)}><ArrowLeft className="w-4 h-4" /> Back</button>}
          <div className="flex-1" />
          <button className="btn" onClick={onClose}>Cancel</button>
          {step === 1 && <button className="btn btn-primary" disabled={!snapshotId} onClick={() => setStep(2)}>Next: targets</button>}
          {step === 2 && <button className="btn btn-primary" disabled={!targets.size} onClick={() => setStep(3)}>Review ({targets.size})</button>}
          {step === 3 && (
            <button className={`btn ${override ? "btn-danger" : "btn-primary"}`} disabled={submitting} onClick={submit}>
              <Rocket className="w-4 h-4" /> {submitting ? "Starting…" : `Push to ${targets.size} account${targets.size === 1 ? "" : "s"}`}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
