---
title: Microsoft Teams
description: Connect HiTechClaw to Microsoft Teams via the Bot Framework.
---

## Prerequisites

- An Azure account with an [Azure AD App Registration](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
- A Bot Channel Registration on [dev.botframework.com](https://dev.botframework.com)

## Setup

### 1. Register Azure AD App

1. Go to **Azure Portal** → **App registrations** → **New registration**
2. Name: "HiTechClaw Bot", set **Supported account types** to Multi-tenant
3. Note the **Application (client) ID**
4. Go to **Certificates & Secrets** → **New client secret** → copy the value

### 2. Register Bot Channel

1. Go to [dev.botframework.com](https://dev.botframework.com) → **Register a bot**
2. Set **Messaging endpoint** to: `https://your-domain/api/channels/msteams/messages`
3. Connect the **Microsoft Teams** channel

### 3. Configure in HiTechClaw

1. Navigate to **Channels** → **Add Channel** → **Microsoft Teams**
2. Enter **App ID** (Client ID) and **App Password** (Client Secret)
3. Optionally set **Tenant ID** (leave empty for multi-tenant)
4. Click **Test Connection** → **Activate**

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `appId` | ✅ | Azure AD Application (Client) ID |
| `appPassword` | ✅ | Client Secret from Azure AD |
| `tenantId` | ❌ | Tenant ID (defaults to `common`) |

## Features

- **OAuth2 authentication**: Automatic token management with refresh
- **Typing indicator**: Shows "typing..." while processing
- **@mention handling**: Strips @mentions from message text
- **Thread/reply support**: Replies maintain conversation context
- **Service URL caching**: Optimized for multi-region deployment