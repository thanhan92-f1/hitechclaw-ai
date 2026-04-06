"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Palette, ServerCog, ShieldAlert, Waypoints } from "lucide-react";
import type { ReactNode } from "react";

const tabs = [
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/appearance", label: "Appearance", icon: Palette },
];

const openClawTabs = [
  { href: "/settings/openclaw", label: "Targets", icon: ServerCog },
  { href: "/settings/openclaw/connectivity", label: "Connectivity", icon: Waypoints },
  { href: "/settings/openclaw/guardrails", label: "Guardrails", icon: ShieldAlert },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isOpenClawSettingsRoute = pathname.startsWith("/settings/openclaw");
  const visibleTabs = isOpenClawSettingsRoute ? openClawTabs : tabs;

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {visibleTabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-medium transition ${
                active
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
