---
title: Facebook Messenger
description: Connect HiTechClaw to Facebook Messenger via the Meta Graph API webhook.
---

## Prerequisites

- A [Meta Business Account](https://business.facebook.com)
- A Facebook Page (the bot will appear as this page)
- A Meta Developer App linked to your page

## Setup

### 1. Create a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**
2. Select **Business**, then add the **Messenger** product
3. Under **Messenger** → **Settings**, generate a **Page Access Token** for your page
4. Note the **Page ID** shown next to your page name

### 2. Configure Webhook

HiTechClaw exposes a universal channel webhook at:

```
GET  https://your-domain/webhooks/channels/:connectionId   ← Meta verification
POST https://your-domain/webhooks/channels/:connectionId   ← Incoming messages
```

In the Meta Developer Portal:
1. Go to **Messenger** → **Webhooks** → **Add Callback URL**
2. Set **Callback URL** to `https://your-domain/webhooks/channels/<connectionId>`
3. Set **Verify Token** to the same value you enter in HiTechClaw
4. Subscribe to the **messages** and **messaging_postbacks** fields

> **Tip**: Get `<connectionId>` from the channel card in HiTechClaw after saving the configuration.

### 3. Configure in HiTechClaw

1. Navigate to **Channels** → **Add Channel** → **Facebook Messenger**
2. Fill in the fields below
3. Click **Test Connection** — HiTechClaw calls the Graph API and returns your page name
4. Click **Activate**

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `pageAccessToken` | ✅ | Long-lived page access token from Meta App |
| `pageId` | ✅ | Facebook Page ID |
| `verifyToken` | ✅ | Custom string for webhook verification |
| `appSecret` | ❌ | App Secret for payload signature verification (recommended) |

## How It Works

- **Incoming text**: Processed via the universal channel message handler
- **Postbacks**: `payload` field from quick-reply buttons is treated as a user message
- **Outgoing**: Sent via `POST /v18.0/me/messages` to the Graph API
- **Webhook verification**: Meta sends a `GET` with `hub.challenge` — HiTechClaw verifies the token and echoes the challenge

## Features

- ✅ Text messages in/out
- ✅ Postback payloads (quick-reply buttons)
- ✅ Test Connection validates page token before activation
- ✅ Universal webhook route shared with WhatsApp/Zalo
- ❌ Image/attachment sending (send text only; receiving images works)

## Limitations

- Facebook pages must be in **Live mode** to receive messages from real users (not just test users)
- Rate limits: 200 calls/user/hour on the Messenger API