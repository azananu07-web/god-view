"use client";
import { useEffect, useState } from "react";
import { X, CheckCircle2, XCircle, Loader2, Clock, ChevronDown, RotateCcw } from "lucide-react";
import type { PushJob, PushTargetStatus } from "@/lib/types";
import { relTime } from "@/lib/format";

const ICON: Record<PushTargetStatus, React.ReactNode> = {
  queued: <Clock className="w-4 h-4 text-ink-3" />,
  pushing: <Loader2 className="w-4 h-4 animate-spin text-brand" />,
  processing: <Loader2 className="w-4 h-4 animate-spin text-brand" />,
  completed: <CheckCircle2 className="w-4 h-4 text-good" />,
  failed: <XCircle className="w-4 h-4 text-critical" />,
};
const LABEL: Record<PushTargetStatus, string> = { queued: "Queued", pushing: "Sending", processing: "Loading in GHL", completed: "Done", failed: "Failed" };

export function jobActive(j: PushJob) {
  return j.targets.some((t) => t.status !== "completed" && t.status !== "failed");
}

export default function JobsPanel({ jobs, onClose, onRetry }: { jobs: PushJob[]; onClose: () => void; onRetry: (jobId: string) => void }) {
  const [open, setOpen] = useState<string | undefined>(jobs[0]?.id);
  const newest = jobs[0]?.id;
  useEffect(() => setOpen(newest), [newest]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end anim-fade" role="dialog" aria-modal="true" aria-label="Snapshot pushes">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative h-full w-full max-w-[480px] bg-[var(--plane)] border-l border-[var(--border)] overflow-y-auto anim-slide">
        <header className="sticky top-0 bg-[var(--plane)] border-b border-[var(--border)] px-5 py-4 flex items-center">
          <h2 className="font-semibold flex-1">Snapshot pushes</h2>
          <button className="btn !p-1.5" onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
        </header>
        <div className="p-4 space-y-3">
          {!jobs.length && <div className="text-sm text-ink-3 text-center py-10">No pushes yet. Click <b>Push</b> on any leaderboard row.</div>}
          {jobs.map((j) => {
            const done = j.targets.filter((t) => t.status === "completed").length;
            const failed = j.targets.filter((t) => t.status === "failed").length;
            const total = j.targets.length;
            const isOpen = open === j.id;
            return (
              <div key={j.id} className="card overflow-hidden">
                <button className="w-full text-left p-4" onClick={() => setOpen(isOpen ? undefined : j.id)} aria-expanded={isOpen}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{j.snapshotName}</div>
                      <div className="text-xs text-ink-3 mt-0.5">
                        {j.sourceName ? `From ${j.sourceName} · ` : ""}{relTime(j.createdAt)}{j.override ? " · override on" : ""}
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-ink-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                  <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-[var(--surface-2)] gap-[2px]" role="progressbar" aria-valuenow={done + failed} aria-valuemax={total}>
                    <div className="bg-good rounded-l-full" style={{ width: `${(done / total) * 100}%` }} />
                    <div className="bg-critical" style={{ width: `${(failed / total) * 100}%` }} />
                  </div>
                  <div className="mt-1.5 text-xs text-ink-2 tnum">
                    {done}/{total} done{failed ? ` · ${failed} failed` : ""}{jobActive(j) ? " · in progress…" : ""}
                  </div>
                </button>
                {failed > 0 && !jobActive(j) && (
                  <div className="px-4 pb-3 -mt-1">
                    <button className="btn !py-1 !text-xs" onClick={() => onRetry(j.id)}>
                      <RotateCcw className="w-3.5 h-3.5" /> Retry {failed} failed
                    </button>
                  </div>
                )}
                {isOpen && (
                  <ul className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
                    {j.targets.map((t) => (
                      <li key={t.locationId} className="px-4 py-2 flex items-start gap-2 text-sm">
                        {ICON[t.status]}
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{t.name}</div>
                          {t.message && <div className="text-xs text-[var(--critical-text)]">{t.message}</div>}
                        </div>
                        <span className="text-xs text-ink-3 whitespace-nowrap">{LABEL[t.status]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
