"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Moon, Sun, Settings, LogOut, RefreshCw, Rocket, LayoutDashboard } from "lucide-react";
import type { SyncState } from "@/lib/types";
import { relTime } from "@/lib/format";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setDark(t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  const flip = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("gv-theme", next); } catch {}
    setDark(!dark);
  };
  return (
    <button className="btn !p-2" onClick={flip} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

type Props = {
  companyName?: string;
  mode?: "live" | "demo";
  sync?: SyncState;
  onSync?: () => void;
  activeJobs?: number;
  onJobs?: () => void;
  page: "dashboard" | "settings";
};

export default function Header({ companyName, mode, sync, onSync, activeJobs = 0, onJobs, page }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--plane)]/90 backdrop-blur">
      <div className="max-w-[1500px] mx-auto px-4 h-14 flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <Eye className="w-5 h-5 text-brand" /> <span className="hidden sm:inline">God View</span>
        </Link>
        {companyName && <span className="text-sm text-ink-2 truncate hidden md:inline">/ {companyName}</span>}
        {mode === "demo" && <span className="rounded-full bg-warn px-2 py-0.5 text-[11px] font-semibold text-[#0b0b0b] whitespace-nowrap">DEMO</span>}
        <div className="flex-1" />
        {sync && onSync && (
          <button className="btn" onClick={onSync} disabled={sync.running} title={sync.message}>
            <RefreshCw className={`w-4 h-4 ${sync.running ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">
              {sync.running ? `Syncing ${sync.done}/${sync.total || "…"}` : `Synced ${relTime(sync.finishedAt)}`}
            </span>
          </button>
        )}
        {onJobs && (
          <button className="btn relative" onClick={onJobs} aria-label="Snapshot pushes">
            <Rocket className="w-4 h-4" /> <span className="hidden sm:inline">Pushes</span>
            {activeJobs > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center px-1">{activeJobs}</span>}
          </button>
        )}
        {page === "dashboard" ? (
          <Link href="/settings" className="btn !p-2" aria-label="Settings"><Settings className="w-4 h-4" /></Link>
        ) : (
          <Link href="/dashboard" className="btn !p-2" aria-label="Dashboard"><LayoutDashboard className="w-4 h-4" /></Link>
        )}
        <ThemeToggle />
        <form action="/api/auth/logout" method="post">
          <button className="btn !p-2" aria-label="Sign out"><LogOut className="w-4 h-4" /></button>
        </form>
      </div>
    </header>
  );
}
