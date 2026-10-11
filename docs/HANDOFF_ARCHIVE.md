> 📦 **過期的交接紀錄**（每次交接把這次的細節接在這份最上面）。不會自動載入，要查用 grep。

## 🚩 2026-10-12 00:20～01:45（家機，在期貨專案的 session 裡做的）：Discord 頻道拆開、文件整理、交接公式
- **Discord webhook 拆開**：比對雜湊確認 PTT `.env.local` 的 `DISCORD_WEBHOOK_URL` 跟期貨「行情」頻道是同一個；使用者建了新頻道的 webhook，
  換進 `.env.local`、重啟 `ptt-web`＋爬蟲、發測試訊息（HTTP 204）。重啟時爬蟲那一輪 exit 1 是因為同時重啟、
  連不到 3200（`ECONNREFUSED`），手動 `kickstart` 再跑一次正常。Koyeb 上的是使用者另一個專案，跟 PTT 無關。
- **文件**：原本 `CLAUDE.md` 只有 `@AGENTS.md` 一行，專案知識全在 `README.md`；README 有三處過期（還寫共用期貨的通道、沒寫專用資料庫帳號、
  通知寫跟期貨同一套）。新 `CLAUDE.md`：文件地圖、交接公式、鐵律、使用者的規則、環境表、常用指令、程式地圖、坑、待辦。
- **順手修的**：`deploy/com.tommy.ptt-web.plist` 跟實際裝的不一樣（10-10 加的 `-H 127.0.0.1` 沒回寫）→ 複製回來；`com.tommy.ptt-tunnel.plist`
  不在 repo → 加進 `deploy/`；`deploy.sh` 原本 `psql -q -d ptt -f db/schema.sql` 用本機超級帳號，之後加的新表會變成超級帳號擁有、程式（帳號 `ptt`）
  沒權限 → 改用 `.env.local` 的 `DATABASE_URL`（資料庫 `ptt` 的擁有者就是 `ptt`；單獨跑那一行成功、三張表擁有者都是 `ptt`）。
- **發現**：PTT 資料庫沒有任何備份（同一晚期貨專案設 Time Machine 時排除了 Postgres 資料夾）。
