---
name: takeover
description: 接手——新 session 開始、換機器、使用者說「接手」時用。只讀 HANDOFF.md、對版本、看網站跟爬蟲的狀態，回報一段摘要再開始做事。
---

# 接手公式（PTT 專案）

目標：用最少的 token 掌握現況。`CLAUDE.md` 已經自動載入，**只再讀 `HANDOFF.md`**；`README.md`、`docs/` 要查某件事才讀。

## 1. 我在哪台機器
- 專案資料夾是 `~/dev/ptt`、而且 `launchctl list | grep ptt` 有東西＝家機（從別台用 VS Code Remote-SSH／`ssh home-mac` 連進來也算），
  專案、資料庫、服務都在這，直接做。
- 不是的話＝在別台電腦自己的資料夾：先 `git pull` 再讀文件；看服務、查 DB、部署都用 `ssh home-mac '…'`（家機路徑 `~/dev/ptt`）。
  跟使用者提一句：直接連進家機接同一個對話更省 token。

## 2. 讀 HANDOFF.md
只讀這份（≤100 行）。

## 3. 對版本（家機上跑）
- `git log -1 --oneline`、`git status -sb`、`git log HEAD..origin/main --oneline`（有沒有還沒 pull 的）。
- 跟 HANDOFF 第 1 段對不上（多了 commit、有沒 commit 的改動）→ 先跟使用者講。

## 4. 服務狀態（家機上跑）
- 網站：`curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3200/`（要 200）；對外 `curl -s -o /dev/null -w '%{http_code}\n' https://ptt.huangyanming.com/`。
- 三個服務：`launchctl list | grep ptt`（`ptt-web`、`ptt-tunnel` 要有 pid；`ptt-macshop-scraper` 平常 pid 是 `-`、exit 0）。
- 爬蟲：`tail -3 logs/scraper.log`（最近一輪應該在 5 分鐘內，`done. checked=N new=N saved=N`）；`tail -5 logs/scraper.error.log`、`tail -5 logs/web.error.log` 有沒有新的錯誤。
- 資料：`psql -At ptt -c "SELECT count(*), max(scraped_at) FROM articles"`（最新一筆的抓取時間）。

## 5. 回報（≤8 行）
版本＋部署狀態、網站／爬蟲正常與否、第 2 段進行中、第 3 段等決定、第 4 段要看的。第 2 段有進行中的事就預設接續它；沒有就問使用者要做什麼。
