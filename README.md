# PTT 特定版爬蟲網站

## 這是什麼

一個獨立、可拋棄的 side project，目的是**練習 AWS**、補履歷用的。跟
`tommy-blog`（同一層的另一個資料夾）完全分開，沒有任何共用的程式碼或
資料庫。

> 2026-09-24 起已經**完全搬離 AWS**，整套跑在家機上（見下方「部署架構」），
> AWS 帳號裡的 ptt 資源全部刪除。AWS 時期的架構與踩坑記錄保留在 `docs/`。

Tommy 本身很熟 Next.js/TypeScript/GCP,目前 AWS 經驗較少,想透過一個
「完整、自己會想用」的網站來練習,而不是做玩具等級的 tutorial。

## 開發說明

本專案的架構規劃、技術選型與問題排查均由開發者本人主導與決策;實作過程
中搭配 AI 編碼工具(Claude Code)協助加速程式撰寫與驗證。

## 要做什麼

抓 PTT 特定看板的文章,存起來,可以搜尋、可以依關鍵字通知。

- **抓哪個看板**:已定案,抓 **MacShop 版**(蘋果產品二手交易版)
- **抓什麼欄位**:`articleId`、`title`、`author`、`postTime`、
  `pushCount`、`url`、`content`。公告/置底文(標題開頭 `[公告]`)不抓
- **功能**:
  - 文章列表 + 搜尋(關鍵字、看板、日期)
  - **關鍵字訂閱通知**:使用者可以訂閱關鍵字(例如「iphone 17」),標題
    符合就發 Discord 通知,也可以取消訂閱。訂閱/取消的操作介面「網頁
    UI」和「Discord 指令」兩者都要做
  - **多使用者**:系統設計成支援多人各自訂閱關鍵字(即使現在只有
    Tommy 自己用),為了以後可能做 buy me a coffee 之類的加值功能,
    所以 DynamoDB schema 從一開始就要帶 userId,不能用單一全域清單。
    Discord webhook 通知邏輯要參考 tommy-blog 現成的模式,但重新寫,
    不要真的 import tommy-blog 的程式碼
- **爬蟲禮儀**:PTT 公開版本身沒有嚴格擋爬蟲,但抓取頻率要保持禮貌(不要
  每秒狂打,本機測試 script 用 1.5 秒 delay),這是禮儀問題不是法律問題

## 部署架構（2026-09-24 起：全部跑在家機）

原本是 API Gateway + Lambda + DynamoDB + Amplify。因為 PTT 擋掉整個 AWS
網段，爬蟲本來就已經搬到自己的電腦跑，AWS 只剩「接收資料」，乾脆整套搬回
家機，做法跟 fubon-futures-monitor 一樣。

- **家機**：`ssh home-mac`（Tailscale），專案在 `/Users/huangyanming/dev/ptt`
- **網站**：Next.js production server，`com.tommy.ptt-web.plist` 常駐在 port 3200
- **對外**：共用 fubon-futures-monitor 那條 Cloudflare Tunnel
  （`~/.cloudflared/config.yml` 多一條 ingress），網址
  **https://ptt.huangyanming.com**
- **資料庫**：家機本機 Postgres，DB 名稱 `ptt`，schema 在 `db/schema.sql`
  （`articles` / `subscriptions` / `page_views`）
- **爬蟲**：`scripts/mac-scraper-daemon.ts`，`com.tommy.ptt-macshop-scraper.plist`
  每 5 分鐘跑一次，POST 到本機 `http://127.0.0.1:3200/api/articles`（要 `x-api-key`）
- **程式分層**：`app/services/` 直接下 SQL（`pg`），頁面與 Server Action 直接呼叫
  services；只有爬蟲走 HTTP API（`app/api/articles`），因為它是另一個 process
- **訂閱管理只走網頁**（`/subscriptions`，Discord OAuth2 登入）。Discord 斜線指令
  已拿掉
- **新文章通知**：跟 fubon-futures-monitor 一樣用 Discord webhook
  （`DISCORD_WEBHOOK_URL`）發到頻道，訊息會 @ 關鍵字符合的訂閱者；失敗重試 3 次。
  沒設 webhook 時改印在 `logs/web.log`。（AWS 時期是 Bot 私訊 + 每人每日 20 篇上限，
  但 Lambda 上的 bot token 其實是空的，從來沒發出去過，搬家時改掉）

### 部署 / 更新

公司機改 code → commit → push，然後：

```bash
ssh home-mac "~/dev/ptt/deploy/deploy.sh"
```

`deploy.sh` 會 `git pull`、檢查 `.env.local`、`npm ci`、套 schema、build、重啟
網站並確認 3200 回 200。爬蟲每次都重新讀原始碼，不用重啟。

### 家機 `.env.local` 需要的值

`DATABASE_URL`、`PTT_API_BASE_URL`、`PTT_API_KEY`、`APP_BASE_URL`（必須是
`https://ptt.huangyanming.com`，Discord OAuth 導回網址用它組）、`SESSION_SECRET`、
`DISCORD_CLIENT_ID`、`DISCORD_CLIENT_SECRET`、`DISCORD_WEBHOOK_URL`（通知用）。

### Log

家機 `~/dev/ptt/logs/`：`web.log` / `web.error.log` / `scraper.log` / `scraper.error.log`

## 資料可攜性

- 資料都是普通的 Postgres 表，備份直接 `pg_dump ptt`
- `scripts/import-backup.ts` 是搬家時把 DynamoDB 匯出的 JSON 倒進 Postgres 用的，
  可重複執行（已存在的列會略過）
