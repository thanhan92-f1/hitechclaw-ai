import { create } from 'zustand';

export type AILanguage = string; // e.g. 'auto', 'vi', 'en', 'ja', etc.
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ModelDefaults {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

interface SettingsState {
  // Language & locale
  aiLanguage: AILanguage;
  aiLanguageCustom: string;
  uiLocale: string;
  // Appearance
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  // AI / Web search
  webSearchEnabled: boolean;
  tavilyApiKey: string;
  // Model defaults
  modelDefaults: ModelDefaults | null;
  // Loaded flag
  loaded: boolean;

  // Actions
  setAiLanguage: (lang: AILanguage) => void;
  setAiLanguageCustom: (custom: string) => void;
  setUiLocale: (locale: string) => void;
  setTheme: (theme: ThemeMode) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setWebSearchEnabled: (enabled: boolean) => void;
  setTavilyApiKey: (key: string) => void;
  setModelDefaults: (defaults: ModelDefaults | null) => void;
  applyFromAPI: (data: Record<string, unknown>) => void;
  setLoaded: (loaded: boolean) => void;
}

const storedTheme = (localStorage.getItem('hitechclaw_theme') as ThemeMode | null) ?? 'system';
const storedSidebar = localStorage.getItem('hitechclaw_sidebar_collapsed') === 'true';

export const useSettingsStore = create<SettingsState>((set) => ({
  aiLanguage: 'auto',
  aiLanguageCustom: '',
  uiLocale: 'vi',
  theme: storedTheme,
  sidebarCollapsed: storedSidebar,
  webSearchEnabled: false,
  tavilyApiKey: '',
  modelDefaults: null,
  loaded: false,

  setAiLanguage: (aiLanguage) => set({ aiLanguage }),
  setAiLanguageCustom: (aiLanguageCustom) => set({ aiLanguageCustom }),
  setUiLocale: (uiLocale) => set({ uiLocale }),
  setTheme: (theme) => {
    localStorage.setItem('hitechclaw_theme', theme);
    set({ theme });
  },
  setSidebarCollapsed: (sidebarCollapsed) => {
    localStorage.setItem('hitechclaw_sidebar_collapsed', String(sidebarCollapsed));
    set({ sidebarCollapsed });
  },
  setWebSearchEnabled: (webSearchEnabled) => set({ webSearchEnabled }),
  setTavilyApiKey: (tavilyApiKey) => set({ tavilyApiKey }),
  setModelDefaults: (modelDefaults) => set({ modelDefaults }),
  applyFromAPI: (data) =>
    set({
      aiLanguage: (data.aiLanguage as AILanguage) ?? 'auto',
      aiLanguageCustom: (data.aiLanguageCustom as string) ?? '',
      webSearchEnabled: (data.webSearchEnabled as boolean) ?? false,
      tavilyApiKey: (data.tavilyApiKey as string) ?? '',
      modelDefaults: (data.modelDefaults as ModelDefaults | null) ?? null,
      loaded: true,
    }),
  setLoaded: (loaded) => set({ loaded }),
}));
