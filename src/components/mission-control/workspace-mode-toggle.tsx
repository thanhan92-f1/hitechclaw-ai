"use client";

import { useState } from "react";
import { LayoutDashboard, ServerCog } from "lucide-react";
import { useTenantFilter } from "./tenant-context";

export function WorkspaceModeToggle() {
  const { mode, setMode, setOpenClawSection } = useTenantFilter();
  const [role] = useState<string>(() => {
    if (typeof document === "undefined") return "viewer";
    const match = document.cookie.match(/mc_role=([^;]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : "viewer";
  });

  const isOwner = role === "owner" || role === "admin";

  if (!isOwner) return null;

  return (
    <div className="flex h-9 items-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-1">
      <button
        type="button"
        onClick={() => setMode("hitechclaw")}
        className={`flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition ${
          mode === "hitechclaw"
            ? "bg-[rgba(0,212,126,0.12)] text-[var(--accent)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}
        aria-pressed={mode === "hitechclaw"}
      >
        <LayoutDashboard className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">HiTechClaw</span>
      </button>
      <button
        type="button"
        onClick={() => {
          setMode("openclaw");
          setOpenClawSection("overview");
        }}
        className={`flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition ${
          mode === "openclaw"
            ? "bg-[rgba(0,212,126,0.12)] text-[var(--accent)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}
        aria-pressed={mode === "openclaw"}
      >
        <ServerCog className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">OpenClaw</span>
      </button>
    </div>
  );
}