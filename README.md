# PTT 特定版爬蟲網站

## 這是什麼

一個獨立、可拋棄的 side project，目的是**練習 AWS**、補履歷用的。跟
`tommy-blog`（同一層的另一個資料夾）完全分開，沒有任何共用的程式碼或
資料庫，之後練習完可以直接把 AWS 資源砍掉,不影響 tommy-blog。

Tommy 本身很熟 Next.js/TypeScript/GCP,目前 AWS 經驗較少,想透過一個
「完整、自己會想用」的網站來練習,而不是做玩具等級的 tutorial。

## 要做什麼

抓 PTT 特定看板的文章,存起來,可以搜尋、可以依關鍵字通知。

- **抓哪個看板**:還沒定案,先討論(選項包含 Stock 版、Tech_Job 版,或
  Tommy 自己感興趣的其他版)
- **抓什麼欄位**:標題、作者、看板、發文時間、內文、推文數(細節待定)
- **功能**:
  - 文章列表 + 搜尋(關鍵字、看板、日期)
  - (加分)關鍵字符合就發 Discord 通知——Tommy 在 tommy-blog 已經有
    現成的 Discord webhook 通知邏輯,可以參考同樣的模式,但這裡要重新
    寫,不要真的去 import tommy-blog 的程式碼
- **爬蟲禮儀**:PTT 公開版本身沒有嚴格擋爬蟲,但抓取頻率要保持禮貌(不要
  每秒狂打),這是禮儀問題不是法律問題

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
- [ ] 確定要抓的看板、欄位
- [ ] 爬蟲邏輯(先在本機測試,確認抓得到資料)
- [ ] AWS 資源規劃與建置(Lambda / DynamoDB / API Gateway / IAM)
- [ ] 前端頁面(列表、搜尋)
- [ ] 部署到 Amplify
- [ ] (加分)關鍵字通知

## 給接手的 Claude Code Session

Tommy 開新視窗接手這個專案時,可以直接從「目前進度」那個清單的第一個
未勾選項目開始問他,不需要重新確認這個專案的目的或範圍——上面已經寫
清楚了。
