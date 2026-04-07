import { create } from 'zustand';

export interface DomainTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface DomainSkill {
  id: string;
  name: string;
  description: string;
  tools: DomainTool[];
}

export interface DomainPack {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category?: string;
  version?: string;
  agentPersona?: string;
  skills: DomainSkill[];
  integrations?: string[];
  installed?: boolean;
}

interface DomainsState {
  domains: DomainPack[];
  installedIds: Set<string>;
  activeDomainId: string | null;
  loaded: boolean;
  setDomains: (domains: DomainPack[]) => void;
  setInstalledIds: (ids: string[]) => void;
  setActiveDomainId: (id: string | null) => void;
  markInstalled: (id: string) => void;
  markUninstalled: (id: string) => void;
  setLoaded: (loaded: boolean) => void;
}

export const useDomainsStore = create<DomainsState>((set) => ({
  domains: [],
  installedIds: new Set<string>(),
  activeDomainId: null,
  loaded: false,
  setDomains: (domains) => set({ domains }),
  setInstalledIds: (ids) => set({ installedIds: new Set(ids), loaded: true }),
  setActiveDomainId: (activeDomainId) => set({ activeDomainId }),
  markInstalled: (id) =>
    set((state) => ({ installedIds: new Set([...state.installedIds, id]) })),
  markUninstalled: (id) =>
    set((state) => {
      const next = new Set(state.installedIds);
      next.delete(id);
      return { installedIds: next };
    }),
  setLoaded: (loaded) => set({ loaded }),
}));
