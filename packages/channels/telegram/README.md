---
title: Telegram
description: Connect a Telegram Bot to HiTechClaw for receiving and sending messages.
---

## Prerequisites

- A Telegram Bot token from [@BotFather](https://t.me/BotFather)

## Setup

### 1. Create a Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the prompts
3. Copy the bot token (e.g., `123456789:ABCdefGHIjklMNOpqrSTUvwxYZ`)

### 2. Configure in HiTechClaw

1. Navigate to **Channels** → **Add Channel**
2. Select **Telegram**
3. Paste your **Bot Token**
4. Click **Test Connection** — you should see your bot's username
5. Click **Create** to save

### 3. Activate

Click **Activate** on the channel card. HiTechClaw will start polling for messages.

## How It Works

- Uses **long polling** (`getUpdates` API) to receive messages
- **Group support**: Bot responds when @mentioned, replied to, or when a command is sent
- **Private chats**: All messages are processed
- **Typing indicator**: Shows "typing..." while processing
- **Message splitting**: Long responses are automatically split at 4096 chars

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `botToken` | ✅ | Bot token from @BotFather |

## Image & Vision Support

When a user sends a **photo**, HiTechClaw automatically:

1. Downloads the image from Telegram's file server
2. Converts it to a base64 data URL
3. **Hard-switches** to the vision model (e.g. `llava:13b` via Ollama, or Gemini) for that message
4. The vision fallback chain is: `ollama-vision → gemini → openai → ollama`

Configure the vision model via env vars:

```bash
VISION_PROVIDER=ollama
VISION_MODEL=llava:13b   # or qwen2.5vl:7b, gemma3:12b
```

No config is needed if `LLM_MODEL` already supports vision (e.g. `gemma3:12b`).

## Realtime Search Detection

For messages about time-sensitive topics (weather, news, prices, scores), HiTechClaw automatically prepends a routing instruction telling the agent to use web-search tools first. This works for both Vietnamese and English.

## Group Chat

In group chats, the bot responds when:
- **@mentioned** by username
- **Replied to** directly
- A **/command** is sent