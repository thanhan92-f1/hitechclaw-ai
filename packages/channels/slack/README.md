---
title: Slack
description: Connect HiTechClaw to your Slack workspace for AI-powered team assistance.
---

## Prerequisites

- A Slack workspace with admin access
- A Slack App created at [api.slack.com](https://api.slack.com/apps)

## Setup

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App**
2. Choose **From scratch**, name it (e.g., "HiTechClaw AI"), select your workspace
3. Navigate to **OAuth & Permissions** → add these Bot Token Scopes:
   - `chat:write` — Send messages
   - `channels:history` — Read channel messages
   - `im:history` — Read DM messages
   - `app_mentions:read` — Detect @mentions
4. Click **Install to Workspace** → authorize
5. Copy the **Bot User OAuth Token** (`xoxb-...`)

### 2. Enable Events (recommended)

1. Go to **Event Subscriptions** → enable
2. Set **Request URL** to your HiTechClaw webhook: `https://your-domain/api/channels/slack/events`
3. Subscribe to bot events: `message.channels`, `message.im`, `app_mention`

### 3. Configure in HiTechClaw

1. Navigate to **Channels** → **Add Channel** → **Slack**
2. Enter your **Bot Token** and **Signing Secret**
3. Click **Test Connection** to verify
4. **Activate** the channel

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `botToken` | ✅ | Bot User OAuth Token (`xoxb-...`) |
| `signingSecret` | ✅ | App signing secret (from Basic Information) |

## Features

- **Thread support**: Replies in threads when messages are in threads
- **@mention detection**: Only responds when mentioned in channels
- **DM support**: All direct messages are processed
- **Rich text**: Supports Slack's mrkdwn formatting