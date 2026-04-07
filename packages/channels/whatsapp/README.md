---
title: WhatsApp
description: Connect HiTechClaw to WhatsApp Business via the Meta Cloud API.
---

## Prerequisites

- A [Meta Business Account](https://business.facebook.com)
- A WhatsApp Business API phone number
- An access token from Meta Developer Portal

## Setup

### 1. Create a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**
2. Select **Business** → **WhatsApp**
3. In **WhatsApp** → **Getting Started**, note your **Phone Number ID** and **Access Token**

### 2. Configure Webhook

1. Set the **Callback URL** to: `https://your-domain/api/channels/whatsapp/webhook`
2. Set a custom **Verify Token** (you'll need this in HiTechClaw config)
3. Subscribe to **messages** webhook field

### 3. Configure in HiTechClaw

1. Navigate to **Channels** → **Add Channel** → **WhatsApp**
2. Enter **Phone Number ID**, **Access Token**, and **Verify Token**
3. Click **Test Connection** → **Activate**

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `phoneNumberId` | ✅ | WhatsApp Business phone number ID |
| `accessToken` | ✅ | Permanent or temporary access token |
| `verifyToken` | ✅ | Custom string for webhook verification |

## Features

- **Read receipts**: Messages are marked as read automatically
- **Text messages**: Full support for incoming/outgoing text
- **Message splitting**: Long responses split at 4096 characters