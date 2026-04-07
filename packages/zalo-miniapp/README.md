# HiTechClaw AI — Zalo Mini App

Ứng dụng chat AI chạy trong Zalo dưới dạng Mini App (ZMP), kết nối với HiTechClaw backend qua REST API + SSE streaming.

## Kiến trúc

```
┌──────────────────────────┐
│     Zalo App (mobile)    │
│  ┌────────────────────┐  │
│  │  HiTechClaw Mini App    │  │
│  │  (React + ZMP UI)  │  │
│  └────────┬───────────┘  │
└───────────┼──────────────┘
            │ HTTPS
            ▼
┌──────────────────────────┐
│  HiTechClaw Backend (Hono)    │
│  POST /auth/zalo-miniapp │
│  POST /api/chat (SSE)    │
│  GET  /api/chat/convs    │
└──────────────────────────┘
```

## Auth Flow

1. User mở Mini App trong Zalo
2. `zmp-sdk` gọi `getAccessToken()` → Zalo access token
3. Mini App gửi token đến `POST /auth/zalo-miniapp`
4. Backend xác thực với Zalo Graph API (`GET https://graph.zalo.me/v2.0/me`)
5. Tạo/tìm user trong PostgreSQL → cấp JWT 24h
6. Mini App dùng JWT cho tất cả API calls

## Yêu cầu

- **Zalo Developer Account** tại [developers.zalo.me](https://developers.zalo.me)
- **Zalo OA** (bắt buộc để phân phối Mini App)
- **ZMP CLI**: `npm install -g zmp-cli`
- **HiTechClaw backend** đang chạy (Docker Compose)

## Setup

### 1. Tạo Zalo Mini App

```bash
# Đăng nhập ZMP CLI
zmp login

# Hoặc tạo app mới trên developers.zalo.me
# → Chọn "Mini App" → Tạo app → Lấy App ID
```

### 2. Cấu hình

Tạo file `.env` trong thư mục này:

```env
VITE_API_URL=https://your-hitechclaw-api.com
VITE_TENANT_SLUG=default
```

Cập nhật `app-config.json` với App ID từ Zalo Developer:

```json
{
  "app": {
    "title": "HiTechClaw AI",
    ...
  }
}
```

### 3. Development

```bash
# Chạy local (Vite dev server)
cd packages/zalo-miniapp
npm run dev

# Chạy với ZMP simulator
npm run start
```

### 4. Build & Deploy

```bash
# Build production
npm run build

# Deploy lên Zalo Platform
zmp deploy
```

## Cấu trúc thư mục

```
packages/zalo-miniapp/
├── app-config.json       # Cấu hình ZMP (permissions, UI)
├── index.html            # HTML entry
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx          # React entry point
    ├── app.tsx           # Root component (tabs, auth)
    ├── env.d.ts          # Type declarations
    ├── lib/
    │   ├── api.ts        # HiTechClawClient singleton
    │   └── zalo-auth.ts  # Zalo SDK → HiTechClaw JWT bridge
    ├── components/
    │   ├── ChatBubble.tsx    # Message bubble (markdown)
    │   ├── ChatInput.tsx     # Input with auto-resize
    │   ├── MessageList.tsx   # Scrollable message list
    │   └── TypingIndicator.tsx
    ├── pages/
    │   ├── ChatPage.tsx      # Main chat interface
    │   └── HistoryPage.tsx   # Conversation history
    └── styles/
        └── app.css       # Mobile-first styling
```

## Tính năng

- ✅ Chat AI với streaming (SSE)
- ✅ Markdown rendering (code blocks, lists, bold...)
- ✅ Auto-login qua Zalo SDK
- ✅ Lịch sử trò chuyện
- ✅ Tạo cuộc trò chuyện mới
- ✅ Xóa cuộc trò chuyện
- ✅ Auto-scroll khi có tin nhắn mới
- ✅ Hỗ trợ IME (tiếng Việt)
- ✅ Mobile-first responsive UI
- ✅ Safe area (iPhone notch)

## Backend Endpoint mới

### `POST /auth/zalo-miniapp`

Exchange Zalo access token for HiTechClaw JWT.

**Request:**

```json
{
  "accessToken": "zalo_access_token_from_sdk",
  "tenantSlug": "default"
}
```

**Response:**

```json
{
  "token": "eyJ...",
  "expiresIn": 86400,
  "user": {
    "id": "uuid",
    "name": "Nguyen Van A",
    "email": "zalo_123@zalo.miniapp",
    "role": "user",
    "tenantId": "uuid"
  },
  "provider": "zalo-miniapp"
}
```

## Lưu ý

- **Zalo OA bắt buộc** để đăng ký và phân phối Mini App
- Zalo user không có email → hệ thống dùng `zalo_{id}@zalo.miniapp` làm định danh
- Mini App chạy trong WebView của Zalo → không cần cài đặt riêng
- Có thể test local bằng `npm run dev` (Vite) mà không cần Zalo simulator
