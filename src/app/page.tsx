import { redirect } from "next/navigation";
import { Eye, Trophy, Siren, Rocket, ShieldCheck } from "lucide-react";
import { getSessionCompanyId } from "@/lib/session";
import { ghlConfigured } from "@/lib/ghl/oauth";

export default function Landing({ searchParams }: { searchParams: { error?: string } }) {
  if (getSessionCompanyId()) redirect("/dashboard");
  const configured = ghlConfigured();
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-3xl w-full">
        <div className="flex items-center gap-2 text-ink-2 text-sm font-medium mb-6">
          <Eye className="w-5 h-5 text-brand" /> God View for HighLevel
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-tight">
          Every sub-account.<br />One screen.
        </h1>
        <p className="mt-4 text-lg text-ink-2 max-w-xl">
          Stop logging into 100 dashboards. See which clients are winning, which are about to churn, and push what works to the ones that aren’t.
        </p>

        {searchParams.error && (
          <div role="alert" className="mt-6 rounded-lg border border-critical/40 bg-[var(--critical-wash)] px-4 py-3 text-sm text-[var(--critical-text)]">
            {searchParams.error}
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <a href="/api/auth/login" className={`btn btn-primary !px-5 !py-2.5 !text-base ${configured ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!configured}>
            <ShieldCheck className="w-5 h-5" /> Connect HighLevel agency
          </a>
          <a href="/api/auth/demo" className="btn !px-5 !py-2.5 !text-base">Explore with demo data (100 clients)</a>
        </div>
        {!configured && (
          <p className="mt-3 text-sm text-ink-3">
            OAuth isn’t configured on this server yet – set <code>GHL_CLIENT_ID</code>, <code>GHL_CLIENT_SECRET</code> and <code>GHL_REDIRECT_URI</code> (see README).
          </p>
        )}

        <div className="mt-12 grid sm:grid-cols-3 gap-4">
          {[
            { icon: Trophy, title: "Global leaderboard", body: "Rank every client by lowest CPL, best show rate, or most revenue." },
            { icon: Siren, title: "Churn predictor", body: "Accounts go red after 3 straight days of lead volume under your threshold." },
            { icon: Rocket, title: "One-click snapshot push", body: "Push a winning funnel or workflow snapshot to underperformers in bulk." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="card p-4">
              <Icon className="w-5 h-5 text-brand" />
              <div className="mt-2 font-semibold">{title}</div>
              <div className="mt-1 text-sm text-ink-2">{body}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
