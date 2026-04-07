# @hitechclaw/chat-sdk

> React & React Native SDK for [HiTechClaw AI Agent Platform](https://github.com/xdev-asia-labs/hitechclaw) — streaming chat, session management, and MCP integration.

## Installation

```bash
npm install @hitechclaw/chat-sdk
```

## Quick Start — React

```tsx
import { HiTechClawProvider, useChat } from '@hitechclaw/chat-sdk/react';

function App() {
  return (
    <HiTechClawProvider config={{ baseUrl: 'https://api.hitechclaw.io', token: 'your-jwt' }}>
      <Chat />
    </HiTechClawProvider>
  );
}

function Chat() {
  const { messages, send, isStreaming, cancel } = useChat({
    domainId: 'customer-service',
    webSearch: true,
  });

  return (
    <div>
      {messages.map(m => (
        <div key={m.id} className={m.role}>
          {m.content}
          {m.isStreaming && <span className="cursor" />}
        </div>
      ))}
      <input onKeyDown={e => e.key === 'Enter' && send(e.currentTarget.value)} />
      {isStreaming && <button onClick={cancel}>Stop</button>}
    </div>
  );
}
```

## Quick Start — React Native

```tsx
import { HiTechClawProvider, useChat, createReactNativeConfig } from '@hitechclaw/chat-sdk/react-native';

const config = createReactNativeConfig({
  baseUrl: 'https://api.hitechclaw.io',
  token: 'your-jwt',
});

export default function App() {
  return (
    <HiTechClawProvider config={config}>
      <ChatScreen />
    </HiTechClawProvider>
  );
}
```

## Core Client (No React)

```typescript
import { HiTechClawClient } from '@hitechclaw/chat-sdk';

const client = new HiTechClawClient({
  baseUrl: 'https://api.hitechclaw.io',
  token: 'your-jwt',
});

// Non-streaming
const response = await client.chat('Hello!');
console.log(response.content);

// Streaming
const { done, cancel } = client.chatStream('Tell me a joke', {
  onTextDelta: (delta, full) => process.stdout.write(delta),
  onFinish: (usage) => console.log('\nTokens:', usage.totalTokens),
});
await done;
```

## API Reference

### `HiTechClawClient`

| Method | Description |
|--------|-------------|
| `login({ email, password })` | Authenticate and store token |
| `setToken(token)` | Set JWT token directly |
| `chat(message, options?)` | Send message (non-streaming) |
| `chatStream(message, callbacks?, options?)` | Send message with SSE streaming |
| `listSessions()` | List all chat sessions |
| `getMessages(sessionId)` | Get session messages |
| `deleteSession(sessionId)` | Delete a session |
| `uploadFile(file, filename)` | Upload attachment (10MB max) |
| `feedback({ messageId, correction, sessionId })` | Submit correction for self-learning |

### `useChat(options?)` Hook

```typescript
const {
  messages,       // ChatMessage[] — all messages
  isStreaming,    // boolean — currently receiving
  send,           // (message: string) => void
  cancel,         // () => void — abort stream
  clear,          // () => void — clear all messages
  setMessages,    // (messages: ChatMessage[]) => void
  sessionId,      // string
  usage,          // TokenUsage | null
  error,          // Error | null
} = useChat({
  sessionId: 'custom-id',        // optional
  domainId: 'healthcare',        // optional
  webSearch: true,                // optional
  initialMessages: [],            // optional
  onFinish: (msg) => {},          // optional
  onError: (err) => {},           // optional
  onToolCall: (name, id) => {},   // optional
  onMeta: (key, data) => {},      // optional — RAG context, search results
});
```

### `useSessions()` Hook

```typescript
const {
  sessions,       // ChatSession[]
  loading,        // boolean
  refresh,        // () => Promise<void>
  deleteSession,  // (id: string) => Promise<void>
  getMessages,    // (id: string) => Promise<ChatMessage[]>
} = useSessions();
```

### Stream Events

| Event Type | Description |
|------------|-------------|
| `text-delta` | Incremental text token |
| `tool-call-start` | AI is calling a tool |
| `tool-call-args` | Tool arguments (streamed) |
| `tool-call-end` | Tool call complete |
| `tool-result` | Tool execution result |
| `meta` | Metadata (RAG context, search results, timing) |
| `finish` | Stream complete with usage stats |
| `error` | Error occurred |

### Config Options

```typescript
interface HiTechClawConfig {
  baseUrl: string;          // Required — server URL
  token?: string;           // JWT token
  defaultDomain?: string;   // Default domain specialization
  webSearch?: boolean;      // Enable web search by default
  timeout?: number;         // Request timeout (default: 60000ms)
  fetch?: typeof fetch;     // Custom fetch (for React Native polyfills)
  headers?: Record<string, string>; // Custom headers
}
```

### Available Domains

`general` · `developer` · `healthcare` · `finance` · `legal` · `education` · `marketing` · `hr` · `customer-service` · `devops` · `data-analyst` · `creative`

## MCP Server Integration

The SDK includes a built-in MCP (Model Context Protocol) server, allowing AI agents like Claude, Copilot, or any MCP-compatible tool to interact with HiTechClaw.

### Setup

Add to your MCP configuration (e.g., `.vscode/mcp.json`, `claude_desktop_config.json`):

```json
{
  "servers": {
    "hitechclaw": {
      "command": "node",
      "args": ["node_modules/@hitechclaw/chat-sdk/dist/mcp/bin.js"],
      "env": {
        "HITECHCLAW_BASE_URL": "https://api.hitechclaw.io",
        "HITECHCLAW_TOKEN": "your-jwt-token"
      }
    }
  }
}
```

Or run standalone:

```bash
HITECHCLAW_BASE_URL=https://api.hitechclaw.io HITECHCLAW_TOKEN=... npx hitechclaw-chat-mcp
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `hitechclaw_chat` | Send a message and get a response |
| `hitechclaw_chat_stream` | Send message with streaming (returns complete text) |
| `hitechclaw_list_sessions` | List all chat sessions |
| `hitechclaw_get_messages` | Get messages in a session |
| `hitechclaw_delete_session` | Delete a session |
| `hitechclaw_feedback` | Submit correction feedback |
| `hitechclaw_login` | Authenticate with credentials |

### Programmatic MCP Server

```typescript
import { HiTechClawClient } from '@hitechclaw/chat-sdk';
import { createMcpServer } from '@hitechclaw/chat-sdk/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const client = new HiTechClawClient({ baseUrl: '...', token: '...' });
const server = createMcpServer(client);
await server.connect(new StdioServerTransport());
```

## TypeScript

Full TypeScript support with exported types:

```typescript
import type {
  ChatMessage,
  ChatSession,
  StreamEvent,
  TokenUsage,
  HiTechClawConfig,
} from '@hitechclaw/chat-sdk';
```

## License

MIT © [xDev Asia](https://xdev.asia)
