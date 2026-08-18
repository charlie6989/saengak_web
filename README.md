# SAENGAK Web

[![CI](https://github.com/charlie6989/saengak_web/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/charlie6989/saengak_web/actions/workflows/ci.yml)

SAENGAK 的品牌與電商網站。前端使用 React、TypeScript 與 Vite；會員及受信任訂單投影使用 Supabase；商品、購物車與 Checkout 以 Shopify 為權威來源；TapPay 由 Shopify Payment App 流程處理。

> **目前狀態：Pre-launch。** 展示站與測試底盤可用，但正式扣款尚未核准。不得只因 build、部署或公開頁面可讀，就宣稱付款、物流或發票已完成驗收。

## 系統架構

```text
React SPA / Vercel
  ├─ Supabase Auth + RLS
  ├─ Supabase Edge Functions
  │    ├─ Shopify Storefront Cart API
  │    └─ Signed Shopify order webhooks
  └─ Shopify Checkout
       └─ TapPay Payment App
```

正式資料的權威來源：

- 商品、Variant、售價與 Checkout URL：Shopify
- 付款狀態：TapPay 與 Shopify 同一筆 Order ID 的後台回讀
- 會員訂單：驗證 HMAC 後的 Shopify webhook 與 Supabase readback
- 物流：物流供應商、Shopify fulfillment 與公開 HTTPS tracking URL
- 發票：發票供應商事件

## 快速開始

需求：

- Node.js 22 或更新的 LTS 版本
- npm 10+
- 本機開發只使用 `.env.local`；不要把 secrets 寫進 repository

```bash
npm ci
cp .env.example .env.local
npm run dev
```

`.env.example` 只列出名稱與安全預設值。`ShopifyWebhookSecret`、Supabase secret/service-role、Shopify Admin token、TapPay Partner Key 等值只能存於平台的 server-side secrets。

## 驗證指令

| 指令 | 用途 |
| --- | --- |
| `npm run typecheck` | TypeScript 型別檢查 |
| `npm test -- --run` | 單元與安全回歸測試 |
| `npm run build` | Production build |
| `npm run verify:content` | 掃描 source、public 與 build assets 的公開內容 |
| `npm run verify:supabase` | Supabase schema、RLS 與 function 靜態基線 |
| `npm run verify:binding` | 驗證 Supabase/Vercel 指向正確 SAENGAK project |
| `npm run test:db` | Docker-backed pgTAP 資料庫測試 |
| `npm run verify:commerce -- <evidence.json>` | 三種 sandbox 交易的跨系統驗收 |
| `npm run verify:production` | 正式網域路由、headers、assets 與未授權拒絕 probe |

CI 不使用正式環境 secrets，因此不會執行 binding、DB、commerce 或 owner-system write。

## Repository 結構

```text
api/                  Vercel test-access API
docs/                 開發、部署與商務驗收文件
scripts/              Release、binding、commerce 與 production 驗證器
src/                  React SPA
supabase/functions/   Edge Functions
supabase/migrations/  Database migrations
supabase/tests/       pgTAP tests
tests/                Node/Vitest tests
```

## 上線關卡

合併程式碼不等於可以正式收款。正式上線至少需要：

1. CI、dependency audit、build 與公開內容檢查通過。
2. Supabase 正式 link、migration dry-run、pgTAP 與 remote readback 通過。
3. TapPay `success`、`failed`、`cancelled` 三種 sandbox 情境全部通過。
4. Shopify、TapPay、Supabase 的 Order ID、金額與狀態一致。
5. 物流、發票、客服、法務與內容核准完成。
6. Server-side `CheckoutReleaseEnabled` 維持 `false`，直到核准上線。

詳細狀態與接手順序見 [開發與上線交接文件](docs/DEVELOPMENT_LAUNCH_HANDOFF.md)。

## 協作與安全

- 開發流程：[CONTRIBUTING.md](CONTRIBUTING.md)
- 安全政策：[SECURITY.md](SECURITY.md)
- 支援邊界：[SUPPORT.md](SUPPORT.md)
- 機密移交：[docs/SECRET_HANDOFF_GUIDE.md](docs/SECRET_HANDOFF_GUIDE.md)

## 授權

本 repository 目前沒有開源授權。原始碼可被公開檢視，不代表授予複製、修改、散布或商業使用權。正式授權條款需由 repository owner／法務另行決定。
