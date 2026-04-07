---
title: Discord
description: Connect a Discord Bot to HiTechClaw for real-time AI conversations in your server.
---

## Prerequisites

- A Discord Bot token from [Discord Developer Portal](https://discord.com/developers/applications)
- **Message Content Intent** enabled in Bot settings

## Setup

### 1. Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**, enter a name (e.g., "HiTechClaw Bot")
3. Navigate to **Bot** → Click **Add Bot**
4. Copy the **Bot Token**

### 2. Enable Required Intents

In the Bot settings page, enable:
- **Message Content Intent** — required to read message text
- **Server Members Intent** — optional, for user context

### 3. Invite Bot to Your Server

1. Go to **OAuth2** → **URL Generator**
2. Select scopes: `bot`, `applications.commands`
3. Select permissions: `Send Messages`, `Read Message History`, `View Channels`
4. Copy the generated URL and open it to invite the bot

### 4. Configure in HiTechClaw

1. Navigate to **Channels** → **Add Channel**
2. Select **Discord**
3. Paste your **Bot Token**
4. Optionally specify **Guild IDs** (comma-separated) to limit to specific servers
5. Click **Create** to save

### 5. Activate

Click **Activate** on the channel card. HiTechClaw will connect via the Discord Gateway WebSocket.

## How It Works

- Uses **Discord Gateway v10** (WebSocket) for real-time message receiving
- **REST API** for sending messages back
- **Auto-reconnect**: If the WebSocket disconnects, the bot reconnects after 5 seconds
- **Heartbeat**: Maintains connection with Discord's heartbeat protocol
- **Message splitting**: Long responses are automatically split at 2000 chars (Discord limit)

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `botToken` | ✅ | Bot token from Discord Developer Portal |
| `guildIds` | ❌ | Comma-separated guild IDs to listen to (empty = all guilds) |

## Message Filtering

- Bot messages and self-messages are ignored
- If `guildIds` is configured, messages from other servers are filtered out
- All non-bot messages in accessible channels are processed