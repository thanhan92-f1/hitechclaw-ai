"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const STORAGE_KEY = "hitechclaw-ai-active-tenant";

interface TenantContextValue {
  /** null = "All Tenants" (owner view), string = specific tenant id */
  activeTenant: string | null;
  setActiveTenant: (id: string | null) => void;
}

const TenantContext = createContext<TenantContextValue>({
  activeTenant: null,
  setActiveTenant: () => {},
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const [activeTenant, setActiveTenantRaw] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      try {
        setActiveTenantRaw(localStorage.getItem(STORAGE_KEY));
      } catch {
        setActiveTenantRaw(null);
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

  return (
    <TenantContext.Provider value={{ activeTenant, setActiveTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantFilter() {
  return useContext(TenantContext);
}
