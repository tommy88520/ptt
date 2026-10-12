@AGENTS.md

# PTT MacShop 版爬蟲＋關鍵字通知網站

> 這份每個 session 都會整份載入，**只放每次都用得到的東西**。專案在做什麼、功能、架構的完整說明在 `README.md`；
> 現在的狀態在 `HANDOFF.md`——**接手先讀它**；要交接／接手照下面「交接公式」。

## 文件地圖

| 檔案 | 內容 | 什麼時候讀 |
|---|---|---|
| `HANDOFF.md` | 現在的狀態（固定 7 段、≤100 行） | **每次接手先讀** |
| `README.md` | 專案是什麼、功能、部署架構（給人看的；架構以它為準） | 不熟這個專案時、改架構前 |
| `docs/HANDOFF_ARCHIVE.md` | 過期的交接段落 | 要查某天發生什麼時 grep |
| `docs/article.md`、`article-api-gateway.md`、`resume-bullets.md` | AWS 時期的技術文章、履歷素材（**歷史，不是現況**） | 使用者要改文章／履歷時 |
| `docs/privacy-policy.md`、`terms-of-use.md` | 條款的文字稿（網站上的在 `app/privacy`、`app/terms`、`app/components/legal.tsx`） | 改條款時 |

## 交接公式

- **接手**：說「接手」或 `/takeover`（`.claude/skills/takeover/`）——只讀 `HANDOFF.md`、對版本、看服務狀態，回報一段摘要。
- **交接**：說「交接」或 `/handoff`（`.claude/skills/handoff/`）——`HANDOFF.md` 照固定格式**整份改寫**、細節接到
  `docs/HANDOFF_ARCHIVE.md` 最上面、commit＋push。
- Claude 的記憶是每台機器各自的，公司機看不到家機的；要跨機器生效的規則寫進這份。
- 換機器最省的做法：公司用 VS Code Remote-SSH 或終端機 `ssh home-mac` 後 `claude --continue`，接同一個對話。

## 鐵律

1. **這是對外公開的網站**（https://ptt.huangyanming.com）。改壞了別人看得到，部署完一定要確認 3200 回 200、首頁打得開。
2. **這個 GitHub repo 是公開的**：文件、commit 訊息不要寫機密，也不要寫其他專案的內部細節。**機密不印出來**：`.env.local`（`DATABASE_URL`、`PTT_API_KEY`、`SESSION_SECRET`、`DISCORD_CLIENT_SECRET`、`DISCORD_WEBHOOK_URL`）只講名稱。
3. **同一台家機上還有別的專案在跑，不要動到它們**：名字不是 `ptt` 開頭的 launchd 服務、別的 Cloudflare 通道設定、別的資料庫、
   別的 Discord 頻道都不是這個專案的。PTT 有自己的通道、資料庫帳號、Discord 頻道（下面「環境」）。
4. **爬蟲禮儀**：每 3 分鐘一輪（2026-10-12 使用者從 5 分鐘改的）、每個請求間隔 1.5 秒（`REQUEST_DELAY_MS`）；要再調快先問使用者。公告／置底文不抓。
5. **改完要部署才生效**（Next.js 要 build）：`./deploy/deploy.sh`。沒有測試環境——部署前先 `npx tsc --noEmit`、`npm run lint`。
6. 文件寫的不一定對，**有疑問先實測**（curl、查 DB、看 log）。

## 使用者的規則（跟期貨專案同一個人，一樣適用）

- **一律用中文（繁體）**，包括做事中間的進度回報。
- **回覆要短**：先講結論跟要他做什麼，細節放後面。
- **他交代的事，做得到的就直接做**，不要列步驟叫他做、不要一項一項問；只有要他的密碼／帳號才做得到的（sudo、Discord／Cloudflare 後台）才請他動手。
- 畫面醜他會在意，順手弄好看。

## 環境

**機器**：家機（專案在 `~/dev/ptt`，一切都跑在這）；另一台電腦用 `ssh home-mac` 連進來。

| 項目 | 現況 |
|---|---|
| 網站 | Next.js 16（App Router、React 19、Tailwind 4）production，port **3200**、只聽 127.0.0.1；launchd `com.tommy.ptt-web`（caffeinate 包著） |
| 對外 | Cloudflare 通道 `ptt-web`（`~/.cloudflared/config-ptt.yml`，launchd `com.tommy.ptt-tunnel`）：`ptt.huangyanming.com`；舊網域 `ptt-alert.` 由 `next.config.ts` 301 轉過去 |
| 資料庫 | 家機 Postgres 17，資料庫 `ptt`、帳號 `ptt`（密碼在 `.env.local` 的 `DATABASE_URL`）；表 `articles`／`subscriptions`／`page_views`（`db/schema.sql`） |
| 爬蟲 | `scripts/mac-scraper-daemon.ts`，launchd `com.tommy.ptt-macshop-scraper` 每 180 秒跑一次，POST `127.0.0.1:3200/api/articles`（`x-api-key`） |
| 通知 | Discord webhook（`DISCORD_WEBHOOK_URL`，**PTT 專用頻道**，2026-10-12 跟期貨拆開）；訊息 @ 關鍵字符合的訂閱者，失敗重試 3 次 |
| 登入 | Discord OAuth2（只有 `/subscriptions` 要登入）；session 是 `jose` 簽的 cookie（`SESSION_SECRET`） |
| Log | `logs/web.log`、`web.error.log`、`scraper.log`、`scraper.error.log` |
| 備份 | 沒有自動備份，使用者決定不用（2026-10-12：「那個資料不見也無所謂」）；要的話手動 `pg_dump ptt`。`backups/` 是 2026-09-24 從 DynamoDB 匯出的舊 JSON |

launchd plist 的正本在 `deploy/`（三個）；改了要複製到 `~/Library/LaunchAgents/` 再 `launchctl unload`／`load`。

**常用**
```
./deploy/deploy.sh                                   # 部署：pull → 檢查 .env.local → npm ci → 套 schema → build → 重啟 → 確認 3200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3200/      # 網站活著嗎
tail -3 logs/scraper.log                             # 爬蟲最近幾輪（done. checked=N new=N saved=N）
launchctl list | grep ptt                            # 三個服務（爬蟲平常 pid 是 -，exit 0 才正常）
launchctl kickstart gui/$(id -u)/com.tommy.ptt-macshop-scraper       # 馬上跑一輪爬蟲
psql ptt                                             # 本機超級帳號（只能走 socket）；程式用的是帳號 ptt
```

## 程式地圖

- `app/page.tsx` 文章列表＋搜尋；`app/subscriptions/page.tsx` 訂閱管理（要登入）；`app/privacy`、`app/terms` 條款。
- `app/services/*.ts`：**直接下 SQL**（`pg`，連線在 `app/lib/db.ts`）——`articles`、`subscriptions`、`notifications`（發 Discord）、
  `categories`（販售／徵求只看分類標籤第一個字）、`pageviews`。頁面跟 Server Action（`app/actions/subscriptions.ts`）直接呼叫 services。
- `app/api/articles/route.ts`：只有爬蟲用（另一個 process，所以走 HTTP＋`x-api-key`）。`app/api/auth/discord/*`：OAuth 登入。
- `app/lib/session.ts`（cookie session）、`app/lib/pageview.ts`。
- `scripts/mac-scraper-daemon.ts`＋`scripts/lib/ptt-scraper.ts`：爬蟲。`scripts/import-backup.ts`：搬家時把 DynamoDB JSON 倒進 Postgres（可重跑）。

## 踩過的坑（一句話版）

- PTT 擋掉整個 AWS 網段，所以 2026-09-24 整套從 AWS 搬回家機；AWS 資源已全部刪除。
- `APP_BASE_URL` 一定要是 `https://ptt.huangyanming.com`（Discord OAuth 導回網址用它組，設成 localhost 手機登入會被導去 localhost）。
- 網站跟爬蟲同時重啟，爬蟲那一輪會連不到 3200、exit 1；下一輪（3 分鐘後）自己就好，或手動 `kickstart` 一次。
- 資料表要由帳號 `ptt` 擁有：`deploy.sh` 用 `.env.local` 的 `DATABASE_URL` 套 schema（用超級帳號建的新表，程式會沒權限）。
- 標題分類變化很多（`[販售/交換]`、`[賣/苗栗]`、`[徵/新北]`），所以只看第一個字。
- `.env.local` 裡的 `OWNER_DISCORD_ID` 現在程式沒有用到（留著沒差）。
- `logs/scraper.log` 的時間是 UTC（台北時間 +8）；`web.error.log` 啟動時那行「Detected additional lockfiles」無害。
- Next.js 16 跟以前不一樣，寫之前先看 `node_modules/next/dist/docs/`（上面 AGENTS.md 那段是 Next 自己產生的，不要手動改）。

## 待辦（細節寫在 HANDOFF.md；新的往下加）

| 事情 | 什麼時候 |
|---|---|
| （目前沒有） | |
