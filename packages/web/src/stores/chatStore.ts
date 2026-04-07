import { create } from 'zustand';

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  streaming?: boolean;
  attachments?: ChatAttachment[];
  domain?: string;
  tokens?: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: string;
}

interface ChatState {
  // Conversation list
  conversations: ConversationSummary[];
  conversationsLoaded: boolean;
  // Messages per session (sessionId → messages[])
  messages: Record<string, ChatMessage[]>;
  // Currently active session
  activeSessionId: string | null;

  // Actions
  setConversations: (conversations: ConversationSummary[]) => void;
  prependConversation: (conversation: ConversationSummary) => void;
  updateConversation: (sessionId: string, updates: Partial<ConversationSummary>) => void;
  removeConversation: (sessionId: string) => void;
  setMessages: (sessionId: string, messages: ChatMessage[]) => void;
  appendMessage: (sessionId: string, message: ChatMessage) => void;
  updateLastMessage: (sessionId: string, updater: (msg: ChatMessage) => ChatMessage) => void;
  setActiveSession: (sessionId: string | null) => void;
  clearMessages: (sessionId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  conversationsLoaded: false,
  messages: {},
  activeSessionId: null,

  setConversations: (conversations) =>
    set({ conversations, conversationsLoaded: true }),

  prependConversation: (conversation) =>
    set((state) => ({ conversations: [conversation, ...state.conversations] })),

  updateConversation: (sessionId, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === sessionId ? { ...c, ...updates } : c
      ),
    })),

  removeConversation: (sessionId) =>
    set((state) => {
      const { [sessionId]: _, ...rest } = state.messages;
      return {
        conversations: state.conversations.filter((c) => c.id !== sessionId),
        messages: rest,
      };
    }),

  setMessages: (sessionId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [sessionId]: messages },
    })),

  appendMessage: (sessionId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: [...(state.messages[sessionId] ?? []), message],
      },
    })),

  updateLastMessage: (sessionId, updater) =>
    set((state) => {
      const msgs = state.messages[sessionId];
      if (!msgs?.length) return state;
      const updated = [...msgs];
      updated[updated.length - 1] = updater(updated[updated.length - 1]);
      return { messages: { ...state.messages, [sessionId]: updated } };
    }),

  setActiveSession: (activeSessionId) => set({ activeSessionId }),

  clearMessages: (sessionId) =>
    set((state) => {
      const { [sessionId]: _, ...rest } = state.messages;
      return { messages: rest };
    }),
}));
