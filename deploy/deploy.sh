#!/bin/bash
# 在家機上執行：拉最新程式碼 → 套 schema → build → 重啟網站。
# 從公司機觸發：ssh home-mac "~/dev/ptt/deploy/deploy.sh"
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:$PATH"
PLIST="$HOME/Library/LaunchAgents/com.tommy.ptt-web.plist"

echo "1/5 拉最新程式碼"
git pull --ff-only

echo "2/5 檢查 .env.local"
for key in DATABASE_URL PTT_API_BASE_URL PTT_API_KEY APP_BASE_URL SESSION_SECRET DISCORD_CLIENT_ID DISCORD_CLIENT_SECRET; do
  grep -q "^$key=." .env.local || { echo "   ❌ .env.local 缺 $key"; exit 1; }
done
# Discord OAuth 導回網址用這個組，設成 localhost 手機登入後會被導去 localhost
grep -q '^APP_BASE_URL=https://' .env.local || { echo "   ❌ APP_BASE_URL 必須是 https://ptt.huangyanming.com"; exit 1; }

echo "3/5 安裝套件 + 套用 schema"
npm ci --silent
psql -q -d ptt -f db/schema.sql

echo "4/5 建置"
rm -rf .next
npm run build

echo "5/5 重啟網站"
mkdir -p logs
launchctl unload "$PLIST" 2>/dev/null || true
sleep 1
launchctl load "$PLIST"

for _ in $(seq 1 20); do
  sleep 1
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3200/ || true)
  [ "$code" = "200" ] && break
done
[ "${code:-}" = "200" ] || { echo "   ❌ 起不來，看 logs/web.error.log"; exit 1; }
echo "完成。本機 3200 回 200，對外：https://ptt.huangyanming.com"
