# 交接（最後更新 2026-10-12 01:45，家機寫）

> **固定 7 段、整份改寫、全長 ≤100 行**。過期內容搬到 `docs/HANDOFF_ARCHIVE.md`（接在最上面）。
> 交接／接手的步驟見 `.claude/skills/handoff/`、`.claude/skills/takeover/`；規則跟環境在 `CLAUDE.md`，專案說明在 `README.md`。

## 1. 版本
- 程式最後一次改動：10-12 那個文件 commit（`deploy/deploy.sh` 套 schema 改用帳號 `ptt`、文件、交接 skill）。網站程式本身還是 `85d2c4e`（09-24），**不用重新部署**
  （這次只改了文件、部署腳本、`deploy/` 裡 plist 的正本）。
- 10-12 01:40 狀態：網站本機／對外都回 200；`ptt-web`、`ptt-tunnel` 在跑；爬蟲每 5 分鐘一輪正常（最近一輪 01:37，`checked=8 new=0`）；
  資料庫 5,873 篇文章、訂閱 0 筆。

## 2. 進行中（做到一半的事）
- 無。

## 3. 等使用者決定
- 無。

## 4. 下次要看
- Discord 通知有沒有發到 **PTT 專用頻道**（10-12 換了 webhook；有新文章符合訂閱關鍵字才會發，現在訂閱是 0 筆，所以平常不會有訊息）。
- 下次真的跑 `./deploy/deploy.sh` 時，確認「3/5 套用 schema」那步正常（改成用 `.env.local` 的 `DATABASE_URL`，單獨跑過那一行是好的，整支還沒跑過）。

## 5. 使用者最近講的新規則／偏好（原話；穩定後搬進 CLAUDE.md「使用者的規則」）
- 「我ptt那個專案，discord的webhook也是共用，我要拆掉那邊 不然擠在一起」→ PTT 的東西跟期貨分開（通道、資料庫帳號、Discord 頻道都拆了）。
- 「幫我把期貨這個專案的交接skill也寫過去…優化一下md，然後再開始寫那個專案專用的交接skill」→ 這個專案也用同一套交接公式。
- 跨專案的規則（中文、回覆短、交代的事直接做）已寫進 CLAUDE.md。

## 6. 最近做完
**10-12**
- 文件整理：`CLAUDE.md` 從只有一行變成完整的規則＋環境速查；`README.md` 改掉三處過期（通道、資料庫帳號、Discord 頻道）；
  新增 `HANDOFF.md`、`docs/HANDOFF_ARCHIVE.md`、`.claude/skills/handoff`、`.claude/skills/takeover`。
- Discord 通知換成 PTT 專用的 webhook（原本跟期貨「行情」頻道共用）；測試訊息發成功。
- `deploy/deploy.sh` 套 schema 改用帳號 `ptt`；`deploy/com.tommy.ptt-web.plist` 補上 `-H 127.0.0.1`（跟實際裝的一樣）、
  加進 `deploy/com.tommy.ptt-tunnel.plist`。

**10-10（在期貨專案的 session 做的）**
- 資料庫改用專用帳號 `ptt`（要密碼）；網站只聽 127.0.0.1；Cloudflare 通道從期貨那條拆出來（`ptt-web`、`config-ptt.yml`）。

**09-24**
- 整套從 AWS 搬回家機（Lambda 邏輯併進 Next.js＋Postgres）、AWS 資源全刪；通知改 Discord webhook；訂閱可指定販售／徵求；舊網域 301；通知改邀請制。

## 7. 已知問題（還沒修／外部）
- 沒有資料庫自動備份——使用者 10-12 決定不用（「暫時不用，那個資料不見也無所謂」），不要再問。
- `logs/scraper.log` 的時間是 UTC（台北時間要 +8）。
- `logs/web.error.log` 每次啟動有一行「Detected additional lockfiles」（Next.js 的提醒，無害）。
- `.env.local` 的 `OWNER_DISCORD_ID` 程式沒用到。
