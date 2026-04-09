"use client";

import { type ReactNode } from "react";

export type ToolTone = "cyan" | "purple" | "amber" | "green" | "red" | "slate";

export function toneClass(color: ToolTone) {
  return {
    cyan: "border-cyan/30 bg-cyan/10 text-cyan",
    purple: "border-purple/30 bg-purple/10 text-purple",
    amber: "border-amber/30 bg-amber/10 text-amber",
    green: "border-green/30 bg-green/10 text-green",
    red: "border-red/30 bg-red/10 text-red",
    slate: "border-border bg-bg-deep/80 text-text-dim",
  }[color];
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: ToolTone;
}) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass(tone)}`}>
      {children}
    </span>
  );
}

export function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div className="relative max-h-[78vh] w-full overflow-y-auto rounded-t-[28px] border border-border bg-bg-card p-5 shadow-[0_-20px_60px_rgba(0,0,0,0.45)]">
        <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-border" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-text">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-border px-3 text-sm text-text-dim"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-text-dim">{label}</div>;
}

export function Pill({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${
        active
          ? "border-cyan/40 bg-cyan/15 text-cyan"
          : "border-border bg-bg-deep/80 text-text-dim"
      }`}
    >
      {children}
    </button>
  );
}
