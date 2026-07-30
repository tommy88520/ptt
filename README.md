# PTT 特定版爬蟲網站

## 這是什麼

一個獨立、可拋棄的 side project，目的是**練習 AWS**、補履歷用的。跟
`tommy-blog`（同一層的另一個資料夾）完全分開，沒有任何共用的程式碼或
資料庫，之後練習完可以直接把 AWS 資源砍掉,不影響 tommy-blog。

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

## 打算用的 AWS 服務(規劃,實際做的時候可以調整)

| 服務 | 用途 |
|---|---|
| Lambda | 定期爬蟲邏輯 + 搜尋 API |
| EventBridge | 排程觸發爬蟲(例如每小時一次) |
| DynamoDB | 存爬到的文章資料 |
| API Gateway | 讓前端呼叫搜尋 API |
| Amplify | 部署 Next.js 前端(AWS 版的 Vercel) |
| IAM | 各服務之間的權限設定,面試常考,要做對 |
| SNS 或 Discord webhook | (加分)關鍵字通知 |

## 技術棧

- Next.js 16 (App Router) + TypeScript + Tailwind CSS(已經用
  `create-next-app` 建好基本骨架)
- 目前還沒接資料庫/後端,這塊要從頭做

## 目前進度

- [x] repo 建好、push 到 `git@github.com:tommy88520/ptt.git`
- [x] Next.js 基本骨架(`create-next-app` 預設內容)
- [x] 確定要抓的看板、欄位(MacShop 版,見上方欄位清單)
- [x] 爬蟲邏輯(`scripts/lib/ptt-scraper.ts` 共用邏輯,可抓列表 + 內文,
      已過濾公告文,支援翻頁)
- [x] AWS 資源建置(DynamoDB / Lambda / API Gateway / IAM,見下方「架構」)
- [x] 前端頁面(`app/page.tsx`,列表 + 關鍵字搜尋,唯讀)
- [x] 關鍵字訂閱通知(Discord `/subscribe` `/unsubscribe` `/subscriptions`
      指令 + 新文章比對後私訊通知,已端對端測試過)
- [x] 網頁版訂閱管理(`app/subscriptions/page.tsx`,用 Discord OAuth2
      登入辨識身分,訂閱/取消透過 Server Action 呼叫 AWS API,API Key
      只存在伺服器環境變數,瀏覽器看不到)
- [x] 非擁有者 Discord 帳號每日通知上限 20 篇(`ptt-rate-limits` 表,
      超過上限會先發一次「已達上限」通知,之後靜默到隔天)
- [x] 網頁瀏覽次數記錄(`ptt-page-views` 表,不用 GA,自己存)
- [x] 使用條款草稿(`docs/terms-of-use.md`)
- [x] 資料匯出/備份 script(`npm run export-data`,見下方「資料可攜性」)
- [ ] 部署前端到 Amplify
- [ ] (可選)EventBridge 排程健康檢查,偵測 Mac 端排程太久沒回報就發
      Discord 警示

## 架構(重要:跟原本規劃不一樣,PTT 會擋 AWS 的 IP)

實測發現 **PTT 會擋掉整個 AWS 網段**(包含 telnet port 23,不只 HTTP),
所以爬蟲不能直接架在 Lambda 裡對 PTT 發請求。改成:

- **爬蟲本體**:跑在 Tommy 的 Mac 上(`scripts/mac-scraper-daemon.ts`,
  透過 `launchd`(`~/Library/LaunchAgents/com.tommy.ptt-macshop-scraper.plist`)
  每 5 分鐘執行一次),因為家用 IP 不會被擋。Mac 已用 `pmset` 關閉系統
  睡眠,長駐運作
- **AWS 這邊只負責接收資料**:API Gateway (`ptt-articles-api`,
  REST API id `56k4liz2ge`) → Lambda (`lambda/api`) → DynamoDB
  (`ptt-articles` / `ptt-subscriptions`)
- `POST /articles`(需 API Key)給 Mac 端寫入新文章,寫入成功時會順便
  掃描 `ptt-subscriptions`、比對關鍵字、透過 Discord Bot 私訊通知
  符合的使用者
- `GET /articles`(公開)給前端搜尋頁用
- Discord 互動由另一個 Lambda(`lambda/discord`)處理,Discord
  Developer Portal 的「互動端點 URL」指向這個 Lambda 的 API Gateway
  路徑 `/discord-interactions`,用 Public Key 驗證簽章
- EventBridge 目前沒用到(原本規劃拿來排程爬蟲,但爬蟲改成本機 launchd
  了),之後可以拿來做健康檢查
- 多使用者身分統一用 **Discord user id** 當 `userId`,不管是從 Discord
  指令訂閱、還是從網頁用 Discord OAuth2 登入訂閱,寫進 `ptt-subscriptions`
  的都是同一個 ID,兩邊資料自然共通
- DynamoDB table 一覽:
  - `ptt-articles`:爬到的文章(PK `articleId`,GSI `board-articleId-index`)
  - `ptt-subscriptions`:訂閱關鍵字(PK `userId`,SK `keyword`)
  - `ptt-rate-limits`:非擁有者每日通知計數(PK `userId`,SK `date`,
    有 TTL,兩天後自動清除)
  - `ptt-page-views`:網頁瀏覽次數(PK `path`,SK `date`)

## 網頁版訂閱管理(Discord OAuth2 登入)

- `/subscriptions` 頁面用「Sign in with Discord」辨識使用者,登入後
  session 存在 httpOnly cookie(`app/lib/session.ts`,用 `jose` 簽章,
  不是明文)
- 訂閱/取消/查詢都是 Server Action(`app/actions/subscriptions.ts`)
  呼叫 AWS API Gateway,**瀏覽器完全看不到 AWS 網址或 API Key**——這兩個
  只存在 Next.js 伺服器端的環境變數(`PTT_API_BASE_URL`、`PTT_WEB_API_KEY`)
- API Gateway 額外開了 `/subscriptions`(GET/POST/DELETE,都要另一把
  獨立的 API Key `ptt-web-app-key`,方便跟 Mac 端的 `ptt-mac-scraper-key`
  分開追蹤用量)和 `/pageviews`(GET/POST,同樣要 API Key)

## 資料可攜性(這個 AWS 帳號以後可能要換掉)

這個專案本來就是「練習用、可拋棄」的 AWS 帳號,所以特別注意不要讓資料被
鎖死在 AWS 專屬格式裡:

- **前端(Next.js)和 Mac 端爬蟲完全不知道背後是 DynamoDB**——它們只認得
  我們自己定義的 HTTP JSON API(`/articles`、`/subscriptions`、
  `/pageviews`)。以後如果要把後端搬去別的平台(換一個資料庫、換一個
  雲端服務商),只要維持同樣的 API 合約,前端和爬蟲的程式碼完全不用改
- **資料紀錄本身是普通的 JSON 物件**(字串、數字、布林值),沒有用
  DynamoDB 專屬的型別(例如 Set、Binary),也沒有用只有 DynamoDB
  才看得懂的欄位設計,換成 Postgres/MongoDB/Firebase 都能直接對應欄位匯入
- **隨時可以把所有表匯出成純 JSON**:`npm run export-data`
  (`scripts/export-data.ts`),會把 `ptt-articles`、`ptt-subscriptions`、
  `ptt-rate-limits`、`ptt-page-views` 四張表全部 dump 到本機
  `backups/`(已加進 `.gitignore`,不會進 git)。建議帳號有任何風險
  (例如免費額度快到期)前,先跑一次留底
- 真的要搬家的話,AWS 專屬、需要重寫的部分只有:Lambda handler 裡呼叫
  DynamoDB SDK 的那幾行、IAM role 設定、API Gateway 的路由設定——業務邏輯
  本身(比對關鍵字、發 Discord 通知、驗證簽章)是普通 Node.js,搬到任何
  平台都能直接用

## 給接手的 Claude Code Session

Tommy 開新視窗接手這個專案時,可以直接從「目前進度」那個清單的第一個
未勾選項目開始問他,不需要重新確認這個專案的目的或範圍——上面已經寫
清楚了。
