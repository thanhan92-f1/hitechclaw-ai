"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const STORAGE_KEY = "hitechclaw-ai-active-tenant";
const MODE_STORAGE_KEY = "hitechclaw-ai-workspace-mode";
const OPENCLAW_SECTION_STORAGE_KEY = "hitechclaw-ai-openclaw-section";
export const OPENCLAW_ENVIRONMENT_STORAGE_KEY = "hitechclaw-ai-openclaw-environment";

export type WorkspaceMode = "hitechclaw" | "openclaw";
export type OpenClawSection =
  | "overview"
  | "runtime"
  | "update"
  | "mcp"
  | "gateway"
  | "bindings"
  | "auth"
  | "provider"
  | "chatgpt"
  | "credentials"
  | "cron"
  | "config-advanced"
  | "memory"
  | "devices"
  | "agents"
  | "domain"
  | "backup"
  | "channels"
  | "plugins"
  | "skills"
  | "hooks"
  | "directory"
  | "models"
  | "system"
  | "environment"
  | "cli-proxy"
  | "self-update"
  | "sessions";

interface TenantContextValue {
  /** null = "All Tenants" (owner view), string = specific tenant id */
  activeTenant: string | null;
  setActiveTenant: (id: string | null) => void;
  mode: WorkspaceMode;
  setMode: (mode: WorkspaceMode) => void;
  openClawSection: OpenClawSection;
  setOpenClawSection: (section: OpenClawSection) => void;
  openClawEnvironmentId: string | null;
  setOpenClawEnvironmentId: (id: string | null) => void;
}

const TenantContext = createContext<TenantContextValue>({
  activeTenant: null,
  setActiveTenant: () => {},
  mode: "hitechclaw",
  setMode: () => {},
  openClawSection: "overview",
  setOpenClawSection: () => {},
  openClawEnvironmentId: null,
  setOpenClawEnvironmentId: () => {},
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const [activeTenant, setActiveTenantRaw] = useState<string | null>(null);
  const [mode, setModeRaw] = useState<WorkspaceMode>("hitechclaw");
  const [openClawSection, setOpenClawSectionRaw] = useState<OpenClawSection>("overview");
  const [openClawEnvironmentId, setOpenClawEnvironmentIdRaw] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      try {
        setActiveTenantRaw(localStorage.getItem(STORAGE_KEY));
        const storedMode = localStorage.getItem(MODE_STORAGE_KEY);
        if (storedMode === "openclaw" || storedMode === "hitechclaw") {
          setModeRaw(storedMode);
        }
        const storedSection = localStorage.getItem(OPENCLAW_SECTION_STORAGE_KEY);
        if (
          storedSection === "overview" ||
          storedSection === "runtime" ||
          storedSection === "update" ||
          storedSection === "mcp" ||
          storedSection === "gateway" ||
          storedSection === "bindings" ||
          storedSection === "auth" ||
          storedSection === "provider" ||
          storedSection === "chatgpt" ||
          storedSection === "credentials" ||
          storedSection === "cron" ||
          storedSection === "config-advanced" ||
          storedSection === "memory" ||
          storedSection === "devices" ||
          storedSection === "agents" ||
          storedSection === "domain" ||
          storedSection === "backup" ||
          storedSection === "channels" ||
          storedSection === "plugins" ||
          storedSection === "skills" ||
          storedSection === "hooks" ||
          storedSection === "directory" ||
          storedSection === "models" ||
          storedSection === "system" ||
          storedSection === "environment" ||
          storedSection === "cli-proxy" ||
          storedSection === "self-update" ||
          storedSection === "sessions"
        ) {
          setOpenClawSectionRaw(storedSection);
        }
        setOpenClawEnvironmentIdRaw(localStorage.getItem(OPENCLAW_ENVIRONMENT_STORAGE_KEY));
      } catch {
        setActiveTenantRaw(null);
        setModeRaw("hitechclaw");
        setOpenClawSectionRaw("overview");
        setOpenClawEnvironmentIdRaw(null);
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const setActiveTenant = useCallback((id: string | null) => {
    setActiveTenantRaw(id);
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Silent
    }
  }, []);

  const setMode = useCallback((nextMode: WorkspaceMode) => {
    setModeRaw(nextMode);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, nextMode);
    } catch {
      // Silent
    }
  }, []);

  const setOpenClawSection = useCallback((section: OpenClawSection) => {
    setOpenClawSectionRaw(section);
    try {
      localStorage.setItem(OPENCLAW_SECTION_STORAGE_KEY, section);
    } catch {
      // Silent
    }
  }, []);

  const setOpenClawEnvironmentId = useCallback((id: string | null) => {
    setOpenClawEnvironmentIdRaw(id);
    try {
      if (id) {
        localStorage.setItem(OPENCLAW_ENVIRONMENT_STORAGE_KEY, id);
      } else {
        localStorage.removeItem(OPENCLAW_ENVIRONMENT_STORAGE_KEY);
      }
    } catch {
      // Silent
    }
  }, []);

  return (
    <TenantContext.Provider
      value={{
        activeTenant,
        setActiveTenant,
        mode,
        setMode,
        openClawSection,
        setOpenClawSection,
        openClawEnvironmentId,
        setOpenClawEnvironmentId,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantFilter() {
  return useContext(TenantContext);
}
