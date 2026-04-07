import { create } from 'zustand';

export interface ChannelConnection {
  _id: string;
  channelType: string;
  name: string;
  status: string;
  config: Record<string, string>;
  agentConfigId?: string;
  lastConnectedAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelTypeInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  configFields: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    placeholder?: string;
  }>;
  setupGuide: string;
}

interface ChannelsState {
  channels: ChannelConnection[];
  channelTypes: ChannelTypeInfo[];
  loaded: boolean;
  setChannels: (channels: ChannelConnection[]) => void;
  setChannelTypes: (types: ChannelTypeInfo[]) => void;
  addChannel: (channel: ChannelConnection) => void;
  updateChannel: (_id: string, updates: Partial<ChannelConnection>) => void;
  removeChannel: (_id: string) => void;
  setLoaded: (loaded: boolean) => void;
}

export const useChannelsStore = create<ChannelsState>((set) => ({
  channels: [],
  channelTypes: [],
  loaded: false,
  setChannels: (channels) => set({ channels, loaded: true }),
  setChannelTypes: (channelTypes) => set({ channelTypes }),
  addChannel: (channel) => set((state) => ({ channels: [...state.channels, channel] })),
  updateChannel: (_id, updates) =>
    set((state) => ({
      channels: state.channels.map((c) => (c._id === _id ? { ...c, ...updates } : c)),
    })),
  removeChannel: (_id) => set((state) => ({ channels: state.channels.filter((c) => c._id !== _id) })),
  setLoaded: (loaded) => set({ loaded }),
}));
