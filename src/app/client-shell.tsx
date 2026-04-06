"use client";

import { useEffect, useState, type ReactNode } from "react";
import { NotionShell } from "@/components/mission-control/app-shell";

export default function ClientShell({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const mountTimer = window.setTimeout(() => {
      setMounted(true);
    }, 0);

    return () => {
      window.clearTimeout(mountTimer);
    };
  }, []);

  if (!mounted) {
    return <div className="min-h-screen" style={{ background: "#0A0A0C" }} />;
  }

  return <NotionShell>{children}</NotionShell>;
}