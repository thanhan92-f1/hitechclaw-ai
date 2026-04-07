import { create } from 'zustand';

export interface AgentLLMConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  capabilities?: {
    vision?: boolean;
    audio?: boolean;
    streaming?: boolean;
    functionCalling?: boolean;
  };
}

export interface AgentConfig {
  _id: string;
  name: string;
  persona: string;
  systemPrompt: string;
  llmConfig: AgentLLMConfig;
  enabledSkills: string[];
  memoryConfig: { enabled: boolean; maxEntries: number };
  securityConfig: { requireApprovalForShell: boolean; requireApprovalForNetwork: boolean };
  maxToolIterations: number;
  toolTimeout: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AgentsState {
  agents: AgentConfig[];
  agentsLoaded: boolean;
  defaultAgentId: string | null;

  // Actions
  setAgents: (agents: AgentConfig[]) => void;
  addAgent: (agent: AgentConfig) => void;
  updateAgent: (id: string, updates: Partial<AgentConfig>) => void;
  removeAgent: (id: string) => void;
}

export const useAgentsStore = create<AgentsState>((set) => ({
  agents: [],
  agentsLoaded: false,
  defaultAgentId: null,

  setAgents: (agents) =>
    set({
      agents,
      agentsLoaded: true,
      defaultAgentId: agents.find((a) => a.isDefault)?._id ?? null,
    }),

  addAgent: (agent) =>
    set((state) => ({
      agents: [...state.agents, agent],
      defaultAgentId: agent.isDefault ? agent._id : state.defaultAgentId,
    })),

  updateAgent: (id, updates) =>
    set((state) => {
      const agents = state.agents.map((a) => (a._id === id ? { ...a, ...updates } : a));
      return {
        agents,
        defaultAgentId: updates.isDefault
          ? id
          : agents.find((a) => a.isDefault)?._id ?? null,
      };
    }),

  removeAgent: (id) =>
    set((state) => {
      const agents = state.agents.filter((a) => a._id !== id);
      return {
        agents,
        defaultAgentId: state.defaultAgentId === id
          ? (agents.find((a) => a.isDefault)?._id ?? null)
          : state.defaultAgentId,
      };
    }),
}));
