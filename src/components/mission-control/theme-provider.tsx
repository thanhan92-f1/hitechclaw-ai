"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "system" | "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  resolved: "dark",
  setMode: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const STORAGE_KEY = "hitechclaw-ai-theme";

function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (stored && ["system", "light", "dark"].includes(stored)) {
        return stored;
      }
    } catch {}
    return "dark";
  });
  const [systemPreference, setSystemPreference] = useState<"light" | "dark">(() => getSystemPreference());
  const resolved = mode === "system" ? systemPreference : mode;

  const applyTheme = useCallback((theme: "light" | "dark") => {
    const root = document.documentElement;
    // Add crossfade transition
    root.style.setProperty("transition", "background-color 200ms ease, color 200ms ease");
    root.setAttribute("data-theme", theme);
    // Update theme-color meta tag
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#F5F5F7" : "#0A0A0C");
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    try { localStorage.setItem(STORAGE_KEY, newMode); } catch {}
  }, []);

  useEffect(() => {
    applyTheme(resolved);
  }, [applyTheme, resolved]);

  // Listen for system preference changes
  useEffect(() => {
    if (mode !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => setSystemPreference(getSystemPreference());
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
