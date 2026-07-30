# 履歷條列草稿

從 `docs/article.md` 這個專案整理出來的履歷用條列,語氣跟部落格文章不同,
偏向動詞開頭、量化、講結果不講過程。依你履歷版面自己挑幾條用,不用全部塞。

## 專案標題（擇一）

- PTT MacShop 關鍵字監控與通知系統(個人專案)
- PTT 二手商品關鍵字雷達 — 全 AWS Serverless 架構(個人專案)

一句話描述(放在標題下面):
> 用 AWS Lambda / DynamoDB / API Gateway / Amplify 建置的全 serverless
> 系統,監控 PTT 特定看板,依使用者訂閱的關鍵字比對新文章並透過 Discord
> 即時通知,支援 Web 介面與 Discord Bot 雙入口管理訂閱。

## 條列(英文版,可直接調整用詞塞履歷)

- Designed and built a full serverless pipeline on AWS (Lambda, API
  Gateway, DynamoDB, IAM) that scrapes a target website, matches new
  content against user-defined keyword subscriptions, and delivers
  real-time notifications via the Discord API
- Diagnosed and worked around a network-level IP block against AWS's
  entire IP range by relocating the scraping workload to a
  self-hosted scheduler, while keeping the AWS-side ingestion,
  storage, and notification pipeline unchanged
- Implemented least-privilege IAM roles per Lambda function, scoping
  each to only the specific DynamoDB tables/actions it needs
- Built a Next.js 16 (App Router) frontend with Discord OAuth2 login,
  Server Actions for mutations, and zero client-side exposure of
  backend API credentials
- Designed DynamoDB access patterns (GSIs, conditional writes) to
  support idempotent ingestion, atomic per-user daily rate limiting,
  and efficient keyword search without a dedicated search service
- Deployed to AWS Amplify Hosting with a custom domain (Cloudflare
  DNS + ACM), diagnosing and fixing two platform-specific SSR
  runtime issues (environment variable propagation, request URL
  resolution) not caught by local testing
- Wrote a self-serve data export tool to keep the system's data
  portable across a potential future migration away from DynamoDB

## 條列(中文版)

- 獨立設計並實作一套全 serverless AWS 架構(Lambda、API Gateway、
  DynamoDB、IAM),爬取目標網站內容、比對使用者訂閱的關鍵字,透過
  Discord API 即時發送通知
- 排查並解決雲端主機被目標網站整個 IP 網段封鎖的問題,將爬蟲執行位置搬
  遷到自架排程,AWS 端的資料接收/儲存/通知邏輯完全不受影響
- 為每個 Lambda function 設計最小權限 IAM role,權限精確限縮到該函式實
  際需要存取的 DynamoDB 資料表與操作
- 用 Next.js 16(App Router)+ Discord OAuth2 打造前端登入與訂閱管理介
  面,透過 Server Action 確保後端 API 金鑰完全不外洩給瀏覽器
- 設計 DynamoDB 存取模式(GSI、條件式寫入)達成:資料寫入去重(避免重
  複通知)、每位使用者每日通知額度的原子性控管、關鍵字搜尋
- 部署到 AWS Amplify Hosting 並綁定自訂網域(Cloudflare DNS + ACM 憑
  證),排查並修復兩個平台特有、本機測試無法重現的 SSR 執行期問題
- 開發資料匯出工具,確保系統資料不被鎖定在特定資料庫格式,保留未來遷移
  彈性

## 面試可以聊的深度題材(先想好,面試被問到不會卡住)

- 「為什麼 Lambda + API Gateway 要拆成兩個服務,不像傳統框架包在一起」
  → 解耦、各自擴展/計費、同一支函式可以插在不同觸發源後面
- 「怎麼做到最小權限」→ 每個 Lambda 一個獨立 IAM role,實際資源 ARN
  範例
- 「遇過最難排查的 bug」→ Amplify SSR 環境變數只在建置階段生效、
  `request.url` 在 SSR compute 裡不可信任這兩個坑,怎麼一步步從
  CloudWatch Logs 縮小範圍
- 「怎麼設計去重/防重複通知」→ DynamoDB `ConditionExpression` 搭配
  `attribute_not_exists`,不用額外鎖
- 「怎麼保護 API」→ API Gateway API Key + Usage Plan 節流、Discord
  Ed25519 簽章驗證、Server Action 隱藏金鑰三種不同情境用不同做法
