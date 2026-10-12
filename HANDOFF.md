# 交接（最後更新 2026-10-12 22:10，家機寫）

> **固定 7 段、整份改寫、全長 ≤100 行**。過期內容搬到 `docs/HANDOFF_ARCHIVE.md`（接在最上面）。
> 交接／接手的步驟見 `.claude/skills/handoff/`、`.claude/skills/takeover/`；規則跟環境在 `CLAUDE.md`，專案說明在 `README.md`。

## 1. 版本
- 程式最後一次改動：爬蟲排程改成每 3 分鐘（`deploy/com.tommy.ptt-macshop-scraper.plist`，10-12 22:06 已裝到家機並重新載入）。
  網站程式本身還是 `85d2c4e`（09-24），不用重新部署。
- 10-12 22:10 狀態：網站本機／對外都回 200；`ptt-web`、`ptt-tunnel` 在跑；爬蟲每 3 分鐘一輪正常；資料庫約 5,900 篇文章。

## 2. 進行中（做到一半的事）
- 無。

## 3. 等使用者決定
- 無。

## 4. 下次要看
- 10-12 凌晨重寫過一次 git 歷史（把當天的文件 commit 合成一個）。別台電腦的這個資料夾如果在那之前 pull 過，`git pull` 會失敗——
  先確認沒有沒推的改動，再 `git fetch && git reset --hard origin/main`。
- Discord 通知有沒有發到 **PTT 專用頻道**（10-12 換了 webhook；有新文章符合訂閱關鍵字才會發，現在訂閱是 0 筆，所以平常不會有訊息）。
- 下次真的跑 `./deploy/deploy.sh` 時，確認「3/5 套用 schema」那步正常（改成用 `.env.local` 的 `DATABASE_URL`，單獨跑過那一行是好的，整支還沒跑過）。

## 5. 使用者最近講的新規則／偏好（原話；穩定後搬進 CLAUDE.md「使用者的規則」）
- 「我ptt那個專案，discord的webhook也是共用，我要拆掉那邊 不然擠在一起」→ PTT 的東西跟期貨分開（通道、資料庫帳號、Discord 頻道都拆了）。
- 「ptt爬蟲幫我改3分鐘」→ 爬蟲頻率使用者說了算；要再調快先問他。
- 「幫我把期貨這個專案的交接skill也寫過去…優化一下md，然後再開始寫那個專案專用的交接skill」→ 這個專案也用同一套交接公式。
- 跨專案的規則（中文、回覆短、交代的事直接做）已寫進 CLAUDE.md。

## 6. 最近做完
**10-12**
- 爬蟲從每 5 分鐘改成每 3 分鐘（使用者：「ptt爬蟲幫我改3分鐘」）；每個請求間隔 1.5 秒沒變。
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
