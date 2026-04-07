---
title: Zalo OA
description: Kết nối HiTechClaw với Zalo Official Account cho thị trường Việt Nam.
---

## Yêu cầu

- Tài khoản [Zalo Developer](https://developers.zalo.me)
- Một Zalo Official Account (OA)
- Access Token từ Zalo Open API

## Thiết lập

### 1. Tạo App trên Zalo Developer

1. Đăng nhập [developers.zalo.me](https://developers.zalo.me) → **Tạo ứng dụng**
2. Vào **Quản lý OA** → chọn OA cần kết nối
3. Copy **OA ID** và **Access Token**

### 2. Cấu hình Webhook

1. Trong Zalo Developer → **Webhook** → thêm URL: `https://your-domain/api/channels/zalo/webhook`
2. Bật sự kiện **user_send_text** (tin nhắn văn bản từ user)

### 3. Cấu hình trong HiTechClaw

1. Vào **Channels** → **Add Channel** → **Zalo OA**
2. Nhập **OA ID** và **Access Token**
3. Nhấn **Test Connection** → **Activate**

## Cấu hình

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| `oaId` | ✅ | ID của Official Account |
| `accessToken` | ✅ | Access Token từ Zalo Open API |
| `appId` | ❌ | App ID (nếu dùng nhiều app) |
| `secretKey` | ❌ | Secret key để xác thực webhook |

## Tính năng

- **Tin nhắn văn bản**: Nhận và gửi tin nhắn text
- **Hình ảnh**: Gửi hình ảnh qua OA API
- **Tự động chia**: Tin nhắn dài tự động chia ở mốc 2000 ký tự
- **OA verification**: Xác thực kết nối tự động khi bật channel