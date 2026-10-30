"use client";
import { useEffect, useState } from "react";
import { Save, ShieldCheck, Link2 } from "lucide-react";
import Header from "./Header";
import type { Settings } from "@/lib/types";

type Info = { settings: Settings; mode: "live" | "demo"; companyId: string; companyName?: string; connected: boolean; scope?: string; tokenExpiresAt?: number };

export default function SettingsView() {
  const [info, setInfo] = useState<Info>();
  const [form, setForm] = useState<Settings>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then(async (r) => {
      if (r.status === 401) return void (window.location.href = "/");
      const j = await r.json();
      setInfo(j);
      setForm(j.settings);
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (r.ok) { setForm((await r.json()).settings); setSaved(true); setTimeout(() => setSaved(false), 2500); }
  }

  const field = (k: keyof Settings, label: string, help: string, type: "number" | "text" = "number") => (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <span className="block text-xs text-ink-3 mb-1">{help}</span>
      <input
        className="input w-full max-w-xs"
        type={type}
        min={type === "number" ? 0 : undefined}
        value={form?.[k] ?? ""}
        onChange={(e) => setForm((f) => f && { ...f, [k]: type === "number" ? Number(e.target.value) : e.target.value })}
      />
    </label>
  );

  return (
    <>
      <Header page="settings" companyName={info?.companyName} mode={info?.mode} />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-semibold">Settings</h1>

        <section className="card p-5">
          <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-brand" /> HighLevel connection</h2>
          {info?.mode === "demo" ? (
            <div className="mt-2 text-sm text-ink-2">
              You’re exploring demo data. <a className="text-brand underline" href="/api/auth/login">Connect your HighLevel agency</a> to pull real sub-accounts.
            </div>
          ) : info ? (
            <dl className="mt-3 grid grid-cols-[140px_1fr] gap-y-1.5 text-sm">
              <dt className="text-ink-3">Agency</dt><dd>{info.companyName ?? "—"} <span className="text-ink-3">({info.companyId})</span></dd>
              <dt className="text-ink-3">Status</dt><dd>{info.connected ? <span className="text-[var(--good-text)]">Connected (Agency token)</span> : "Not connected"}</dd>
              <dt className="text-ink-3">Token refresh</dt><dd>{info.tokenExpiresAt ? `Auto-refreshes · current expires ${new Date(info.tokenExpiresAt).toLocaleString()}` : "—"}</dd>
              <dt className="text-ink-3">Scopes</dt><dd className="text-xs text-ink-2 break-words">{info.scope ?? "—"}</dd>
            </dl>
          ) : null}
          <a href="/api/auth/login" className="btn mt-4"><Link2 className="w-4 h-4" /> {info?.mode === "live" ? "Re-authorize" : "Connect HighLevel"}</a>
        </section>

        {form && (
          <form onSubmit={save} className="card p-5 space-y-5">
            <h2 className="font-semibold">Churn predictor & data</h2>
            {field("churnThreshold", "Lead threshold (leads/day)", "A completed day with fewer leads than this counts as a low day. Override per sub-account from its detail panel.")}
            {field("churnDays", "Consecutive low days before red", "Accounts with fewer low days show as Watch (amber).")}
            {field("adSpendCustomValueKey", "Ad spend custom value key", "Custom value on each sub-account holding daily ad spend, a number or JSON {\"YYYY-MM-DD\": spend}. Sync it from Meta/Google with Zapier, Make or n8n.", "text")}
            {field("syncWindowDays", "Sync window (days)", "How much history to pull on each sync (14–180). 60 covers the 30-day view plus its comparison period.")}
            <button className="btn btn-primary"><Save className="w-4 h-4" /> {saved ? "Saved ✓" : "Save settings"}</button>
          </form>
        )}
      </main>
    </>
  );
}
