# 用 AWS 全套服務做一個 PTT MacShop 關鍵字通知機器人,結果被 PTT 擋了 IP

## 動機

我平常主要寫 Next.js / TypeScript,GCP 用得比較熟,但 AWS 幾乎沒碰過。與其看
教學影片跟著做玩具範例,我想做一個「自己真的會想用」的小專案來練 AWS,順便
補履歷。

需求很單純:PTT MacShop 版(蘋果產品二手交易版)上,只要有人貼文標題符合我
訂閱的關鍵字(例如「iPhone 17」),就透過 Discord 私訊通知我,而且要能自己
取消訂閱。

原本規劃的 AWS 服務清單長這樣:

| 服務 | 用途 |
|---|---|
| Lambda | 定期爬蟲邏輯 + 搜尋 API |
| EventBridge | 排程觸發爬蟲(例如每 5 分鐘一次) |
| DynamoDB | 存爬到的文章資料 |
| API Gateway | 讓前端呼叫搜尋 API |
| Amplify | 部署 Next.js 前端 |
| IAM | 各服務之間的權限設定 |
| Discord webhook/Bot | 關鍵字符合就通知 |

看起來就是一個很標準的 serverless 排程爬蟲架構。實際做下去才發現,這個架構
從第一步就走不通。

## 帳號與 IAM:先把基本功做對

在動任何服務之前,先把帳號安全性跟權限模型建好:

- Root 帳號開 MFA,平常完全不用 root 登入
- 另外建一個 IAM 使用者做日常操作,一樣開 MFA,權限給 `AdministratorAccess`
  (個人練習用的沙盒帳號,橫跨的服務太多,這樣分工比較實際;真正該做
  least privilege 的是後面每個 Lambda 的**執行角色**)
- 用 `aws login`(AWS CLI 較新的功能)取得臨時憑證,而不是建立長期有效的
  Access Key——借用 Console 登入的 session 換一組會過期的憑證,不用擔心
  金鑰外洩後被永久濫用
- 設定 Billing Budget(Zero spend budget),一旦帳戶開始有任何花費就寄信
  通知,不用等月底帳單才發現手滑

## 踩雷:PTT 會擋掉整個 AWS 網段

第一版的 Lambda 邏輯很直觀:用 `fetch` 打 `https://www.ptt.cc/bbs/MacShop/index.html`,
用 `cheerio` 解析文章列表,寫進 DynamoDB。本機測試(`npx tsx`)完全沒問題,抓
到 20 篇文章,內文、作者、推文數都正確。

部署到 Lambda 之後,執行馬上噴錯:

```
TypeError: fetch failed
  [cause]: Error: read ECONNRESET
    errno: -104, code: 'ECONNRESET', syscall: 'read'
```

`ECONNRESET` 是連線在 TLS handshake 階段被對方主動斷開,不是逾時、不是
DNS 錯誤。先做對照組排除是不是 Lambda 網路本身有問題:

```js
await fetchPage("https://www.google.com");  // OK
await fetchPage("https://www.ptt.cc/...");   // ECONNRESET
```

Google 連得到,PTT 連不到——問題出在 PTT 那端,不是我們的網路設定。接著懷疑
是不是只有東京 region(`ap-northeast-1`)被擋,於是在 `us-east-1` 建一個一
模一樣的 Lambda 測試,結果完全相同的 `ECONNRESET`。換句話說,**不是特定
region 的問題,是 PTT(或它前面的防護層)把整個 AWS 的 IP 網段都擋了**,這
是網站防止雲端主機大量爬蟲常見的做法。

最後一個念頭:PTT 網頁版只是包在原始 BBS 服務外面的一層,原始服務是走
telnet(`bbs.ptt.cc:23`)。網頁層的 WAF 擋歸擋,telnet 那條線會不會沒被
一起擋?用 Node 內建的 `net` 模組直接測 TCP 連線:

```js
function testTelnetConnect(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    // ...
    socket.once("error", (err) => resolve(`ERROR: ${err.code}`));
  });
}
```

結果是 `ECONNREFUSED`,而且是立刻被拒絕,不是逾時。`ECONNRESET`(HTTPS)跟
`ECONNREFUSED`(telnet)是兩種不同的失敗方式,但結論一致:**PTT 在網路層
擋掉了 AWS 的網段,不分 port、不分協定**。這條路徹底走不通,不管怎麼換
region、換協定都一樣。

## 調整後的架構:爬蟲搬出雲端,AWS 只負責接收

換方向思考:既然 AWS 的 IP 出不去,那就讓「真正發出 HTTP 請求」這件事發生在
一個 PTT 不會擋的地方,AWS 只負責接收爬到的資料、儲存、查詢、通知。

曾經考慮過的選項:

1. **改用代理服務轉發請求**:要用 residential proxy(住宅 IP 代理),不是
   便宜的 datacenter proxy(那本質上還是另一台雲端主機的 IP,一樣可能被
   擋)。可行,但要多一個按流量計費的外部依賴
2. **買一台 Raspberry Pi 放家裡**:家用 IP 不會被擋,24/7 運作,但要多花
   錢買硬體
3. **用家裡本來就有的閒置電腦**:不用額外花錢,只要那台機器能穩定長時間
   開機連網就好

最後選了第 3 個方案。技術上要注意的細節:

- **筆電閤上上蓋預設會觸發系統睡眠**,睡眠中排程不會準時執行,跟關機沒兩
  樣。要用 `pmset -c sleep 0`、`pmset -c disksleep 0` 關掉系統睡眠(`-c`
  代表只在接電源時套用),螢幕鎖定、螢幕關閉都不影響,只有系統睡眠會
  中斷背景程式
- **排程用 `launchd`(macOS 原生機制),不是簡單的 `setInterval`**:寫成
  LaunchAgent(`~/Library/LaunchAgents/xxx.plist`),設定 `StartInterval`
  每 300 秒觸發一次,好處是系統重開機、程式崩潰都能自動恢復,而且有獨立
  的 stdout/stderr log 檔方便除錯

最終架構:

```
┌─────────────┐  每 5 分鐘   ┌──────────────┐
│  PTT MacShop │ ◄─────────── │ Mac(launchd) │
│   (家用 IP)  │   HTTP GET   │  爬蟲 + 解析  │
└─────────────┘              └──────┬───────┘
                                     │ POST /articles (API Key)
                                     ▼
                          ┌────────────────────┐
                          │   API Gateway       │
                          └──────────┬──────────┘
                                     ▼
                          ┌────────────────────┐      比對關鍵字後
                          │ Lambda(ingest/查詢)  │ ───► 呼叫 Discord API 私訊
                          └──────────┬──────────┘
                                     ▼
                          ┌────────────────────┐
                          │      DynamoDB       │
                          │ ptt-articles         │
                          │ ptt-subscriptions    │
                          └────────────────────┘
                                     ▲
                          ┌──────────┴──────────┐
                          │  Next.js 前端搜尋頁   │
                          │ (GET /articles)      │
                          └──────────────────────┘

┌─────────────┐  slash command   ┌──────────────────────┐
│   Discord    │ ───────────────► │ Lambda(互動處理,      │
│  使用者       │ ◄─────────────── │ Ed25519 簽章驗證)      │
└─────────────┘   ephemeral 回覆   └──────────────────────┘
```

EventBridge 在原本規劃是拿來排程觸發爬蟲,但爬蟲搬到本機 launchd 之後暫時
用不到,先留著之後可以拿來做「健康檢查」:排程一個 Lambda 定期檢查
`ptt-articles` 最新一筆的 `scrapedAt` 有沒有太久沒更新,太久沒動就發 Discord
警示,代表本機爬蟲可能掛了。

## DynamoDB 資料表設計

兩張表,設計時就把「多使用者」考慮進去,即使現在只有我自己在用:

**`ptt-articles`**——存爬到的文章

- Partition key:`articleId`(PTT 文章代碼,例如 `M.1785294755.A.5F2`,本身
  就內嵌一個遞增的 timestamp,天生適合當排序依據)
- GSI `board-articleId-index`:PK `board` + SK `articleId`,查詢「某個看板
  最新的文章」時用得到,倒序排就是新到舊
- 寫入時用 `ConditionExpression: attribute_not_exists(articleId)`,同一篇
  文章不管被掃到幾次都只會寫入一次,天然去重

**`ptt-subscriptions`**——存誰訂閱了什麼關鍵字

- Partition key:`userId`(這裡直接用 Discord 的使用者 ID,不用另外做登入
  系統就天生支援多人)
- Sort key:`keyword`,一個人可以訂多個關鍵字

去重的好處不只是省儲存空間——**通知只會在文章「第一次」被寫進資料庫時觸
發**,靠的就是這個 `ConditionExpression`。之後排程再掃到同一篇文章會直接
被拒絕寫入(`ConditionalCheckFailedException`),不會重複通知。

## IAM:每個 Lambda 只給它需要的權限

面試常考的「最小權限原則」,實際做法是每個 Lambda 開一個獨立的執行角色,
權限縮到剛好夠用:

```json
// ptt-scraper-lambda-role:負責寫入/查詢文章、掃描訂閱表發通知
{
  "Effect": "Allow",
  "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query"],
  "Resource": [
    "arn:aws:dynamodb:...:table/ptt-articles",
    "arn:aws:dynamodb:...:table/ptt-articles/index/*"
  ]
},
{
  "Effect": "Allow",
  "Action": ["dynamodb:Scan"],
  "Resource": "arn:aws:dynamodb:...:table/ptt-subscriptions"
}
```

```json
// ptt-discord-lambda-role:只處理訂閱表的增刪查,完全碰不到文章表
{
  "Effect": "Allow",
  "Action": ["dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:Query"],
  "Resource": "arn:aws:dynamodb:...:table/ptt-subscriptions"
}
```

兩個角色互相看不到對方負責的表,就算其中一個 Lambda 的程式碼被打穿,能造
成的破壞範圍也被鎖死在它原本該碰的資料。

## API Gateway:一個公開只讀、一個要 API Key

一個 REST API,兩個資源:

- `POST /articles`:給 Mac 端寫入新文章用,`--api-key-required` 開啟,綁一
  個 Usage Plan 加上節流(`rateLimit=2, burstLimit=5`),防止意外暴衝把
  DynamoDB 寫爆
- `GET /articles`:公開、不用金鑰,前端搜尋頁直接呼叫,支援 `board` 和
  `keyword` 兩個 query 參數

```js
async function handleListArticles(event) {
  const { board = "MacShop", keyword, limit = 20 } = event.queryStringParameters ?? {};

  const queryInput = {
    TableName: ARTICLES_TABLE,
    IndexName: "board-articleId-index",
    KeyConditionExpression: "board = :board",
    ExpressionAttributeValues: { ":board": board },
    ScanIndexForward: false, // articleId 內嵌 timestamp,倒序 = 新到舊
  };
  if (keyword) {
    queryInput.FilterExpression = "contains(title, :keyword)";
    queryInput.ExpressionAttributeValues[":keyword"] = keyword;
  }
  // ...
}
```

## Discord Bot:Slash Command + 簽章驗證 + DM 通知

Discord 的 Slash Command 不需要一個常駐的 bot process,而是 Discord 在使用
者觸發指令時,對你設定的「互動端點 URL」發一個 HTTP POST——完全符合
Lambda + API Gateway 的無伺服器模型。

要注意的地方是**簽章驗證**:Discord 會在每個請求附上
`x-signature-ed25519` 和 `x-signature-timestamp`,你的端點必須用應用程式
的 Public Key 驗證這個簽章,驗證失敗要回 401,否則 Discord 會拒絕把這個
URL 設成互動端點:

```js
const isValid = await verifyKey(rawBody, signature, timestamp, DISCORD_PUBLIC_KEY);
if (!isValid) {
  return { statusCode: 401, body: JSON.stringify({ error: "Invalid request signature" }) };
}

const interaction = JSON.parse(rawBody);
if (interaction.type === InteractionType.PING) {
  return { statusCode: 200, body: JSON.stringify({ type: InteractionResponseType.PONG }) };
}
```

`/subscribe`、`/unsubscribe`、`/subscriptions` 三個指令,對應寫入/刪除/
查詢 `ptt-subscriptions` 表,回覆用 `flags: 64`(ephemeral)讓只有下指令
的人看得到回覆,不會洗版頻道。

通知邏輯放在文章寫入成功的那一刻觸發:

```js
async function notifySubscribers(article) {
  const lowerTitle = article.title.toLowerCase();
  const subs = await ddb.send(new ScanCommand({ TableName: SUBSCRIPTIONS_TABLE, ... }));
  const matched = subs.Items.filter((s) => lowerTitle.includes(s.keyword));

  await Promise.all(matched.map(async (sub) => {
    const channel = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
      body: JSON.stringify({ recipient_id: sub.userId }),
    }).then((r) => r.json());

    await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
      body: JSON.stringify({ content: `PTT ${article.board} 新文章:\n${article.title}\n${article.url}` }),
    });
  }));
}
```

發私訊要先呼叫一次 API 開 DM channel(或取得既有的),拿到 channel id 才能
真的送訊息,這是 Discord Bot API 的固定兩步驟。

## 前端:Next.js Server Component,不需要另外做 API 層

前端很單純,一個 Server Component 直接讀 `searchParams`、打 API Gateway
的 `GET /articles`,搜尋表單用最單純的 GET form,靠 URL query string
驅動整個頁面重新渲染,不需要額外寫 `useState`/`useEffect`:

```tsx
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ keyword?: string; board?: string }>;
}) {
  const { keyword, board = "MacShop" } = await searchParams;
  const articles = await fetchArticles(keyword, board);
  return (/* ... */);
}
```

## 心得

這個專案最有價值的部分不是任何一個服務怎麼設定,而是**第一版架構在第一步
就被現實打臉**——雲端主機被目標網站整個網段擋掉,是做爬蟲類專案很容易低估
的風險。教訓是:

- 本機測試會過,不代表雲端環境也會過,**執行環境的網路身份本身就是一種
  依賴**,尤其對方是有防護意識的服務
- 排查網路問題時,做「對照組」很重要(換一個一定通的網址測)——先確認
  是不是自己的網路設定有問題,再往下懷疑對方
- 架構要有彈性:發現此路不通之後,只需要把「發送 HTTP 請求」這一小塊搬
  到別的地方,DynamoDB、Lambda、API Gateway、IAM 這些原本規劃的核心
  沒有整個重來

## 之後要做的

- 部署前端到 Amplify,拿到一個真的能公開存取的網址
- 網頁版的訂閱管理(現在只有 Discord 指令能訂閱,網頁還是唯讀),等做完
  AWS Cognito 登入之後一起補上——這樣使用者體系從一開始就跟訂閱關鍵字綁
  在一起,不用之後再搬資料
- (可選)用 EventBridge 排程一個健康檢查 Lambda,監控本機爬蟲多久沒回報
