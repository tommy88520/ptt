# 用 AWS 全套服務做一個 PTT MacShop 關鍵字通知機器人,結果被 PTT 擋了 IP

## 動機

我平常主要寫 Next.js / TypeScript,GCP 用得比較熟,但 AWS 幾乎沒碰過。與其看
教學影片跟著做玩具範例,我想做一個「自己真的會想用」的小專案來練 AWS,順便
補履歷。

需求很單純:PTT MacShop 版(蘋果產品二手交易版)上,只要有人貼文標題符合我
訂閱的關鍵字(例如「iPhone 17」),就透過 Discord 私訊通知我,而且要能自己
取消訂閱。

專案現在真的上線了:**https://ptt-alert.huangyanming.com**

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

## 網頁版訂閱管理:Discord OAuth2 登入 + Server Action 藏金鑰

一開始只有 Discord 指令能訂閱關鍵字,後來想讓不想用 Discord 指令、只想用
網頁操作的人也能管理訂閱。因為通知本來就是走 Discord DM,所以身分驗證乾
脆也用「Sign in with Discord」(OAuth2 Authorization Code Flow),不用另外
做一套帳號系統,登入後拿到的 Discord user id 直接跟訂閱表的 `userId` 共
用,兩邊資料天生一致。

Session 用 Next.js 官方文件示範的做法:`jose` 簽章一個 JWT,存進
`httpOnly` cookie,不用額外的 auth 套件:

```ts
export async function createSession(userId: string, username: string) {
  const session = await new SignJWT({ userId, username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);

  (await cookies()).set("session", session, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
}
```

訂閱/取消/查詢這幾個會動到資料的操作,寫成 Next.js 的 **Server Action**
(`"use server"`)。這是這次前端设计上比較刻意的地方:瀏覽器只會呼叫「自
己的網站」,不會直接打 AWS 的 API Gateway,更不會看到 API Key——

```
瀏覽器 ──(表單送出)──▶ Next.js Server(Server Action)──(帶著 API Key)──▶ API Gateway
```

API Key、AWS 網址都只存在 Next.js 伺服器端的環境變數,永遠不會出現在瀏覽
器的 Network 分頁裡。AWS 那邊另外開了一把獨立的 API Key(`ptt-web-app-key`)
給網頁用,跟 Mac 端排程用的那把分開,方便個別追蹤用量、個別停用。

## 每日額度、瀏覽統計、SEO、法律頁面

上線前補了幾個「小而必要」的東西:

- **非擁有者帳號每日通知上限 20 篇**:用 DynamoDB 的 `ConditionExpression`
  做原子性的「讀取當前計數 + 判斷是否超過 + 遞增」,一次 `UpdateItem`
  搞定,不用額外上鎖:
  ```js
  UpdateExpression: "SET #count = if_not_exists(#count, :zero) + :one",
  ConditionExpression: "attribute_not_exists(#count) OR #count < :limit",
  ```
  超過上限那一刻,額外用另一個欄位 `limitNotified` 做同樣的「原子性判斷
  是否已通知過」,確保「已達上限」這句提示訊息一天只會發一次,不會每篇
  新文章都重複提醒
- **頁面瀏覽記錄**:一開始想接 Google Analytics,後來想想只是想知道大概
  有多少人在看,不需要即時、不需要第三方工具,乾脆自己存一張
  `ptt-page-views` 表(PK 頁面路徑、SK 日期),比 GA 更輕量也更貼近「這是
  AWS 練習專案」的主軸
- **SEO**:針對「PTT 通知」「PTT 關鍵字通知」這類搜尋詞下 `title`、
  `description`、`keywords`、OpenGraph
- **使用條款 + 隱私權政策**:因為有蒐集 Discord ID/暱稱、發 session
  cookie,這兩份分開寫成真的頁面(`/terms`、`/privacy`),而不是隨便帶過

## 資料可攜性:不要被鎖在 DynamoDB 格式裡

這個 AWS 帳號本質上是練習用、隨時可能不續用,所以特別注意**資料不能被鎖
死**。做法很簡單但很有效:

1. 前端跟 Mac 端爬蟲**只認得我們自己定義的 HTTP JSON API**,完全不知道
   背後是 DynamoDB。以後要換資料庫、換平台,只要維持同樣的 API 合約,前
   端和爬蟲的程式碼一行都不用改
2. 資料本身存的都是普通的 JSON 物件(字串/數字/布林值),沒有用 DynamoDB
   專屬型別
3. 寫一支 `export-data` script,隨時能把所有表 dump 成純 JSON 備份到本機

```ts
async function scanAll(tableName: string) {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey;
  do {
    const result = await ddb.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey }));
    items.push(...(result.Items ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}
```

## 部署到 Amplify 踩的兩個坑

功能都做完、本機測試也都過,實際部署到 Amplify Hosting 之後,首頁直接
500。這段除錯過程比前面爬蟲被擋更隱蔽,因為錯誤訊息一開始完全看不出跟
Amplify 有關。

### 坑 1:環境變數在 Console 設定了,但 SSR 執行時讀到 `undefined`

Console 裡明明看得到 `PTT_API_BASE_URL` 這些變數,`aws amplify list-apps`
也查得到,但 CloudWatch Logs 顯示:

```
TypeError: Invalid URL
  input: 'undefined/articles'
```

查了才知道:**Amplify Hosting 對 Next.js SSR(WEB_COMPUTE 平台)的環境變
數,預設只在「建置階段」生效,不會被帶進實際服務請求的 Lambda**(這是
Amplify 已知的落差,GitHub 上有對應的 issue #1987、#3345)。build 階段能
讀到值,`next build` 順利跑完;但 request 進來時,服務那個 Lambda 完全不
認得這些變數。

解法是在建置腳本裡,把需要的變數寫進 `.env.production`,讓 Next.js 把它
們一起打包進 SSR 輸出(Next.js 本來就會自動載入 `.env.production`):

```yaml
# amplify.yml
preBuild:
  commands:
    - npm ci --cache .npm --prefer-offline
    - echo "PTT_API_BASE_URL=$PTT_API_BASE_URL" >> .env.production
    - echo "PTT_WEB_API_KEY=$PTT_WEB_API_KEY" >> .env.production
    # ...其他變數同樣處理
```

### 坑 2:`request.url` 在 Amplify 的執行環境裡不可信任

修完坑 1,首頁正常了,但 Discord 登入按下去顯示「redirect_uri 無效」。原
本的程式碼用 `new URL("/api/auth/discord/callback", request.url)` 動態組
出 OAuth 的 redirect_uri,這在本機、在大多數平台都沒問題——但在 Amplify
的 SSR compute 環境裡,`request.url` 解析出來的主機名稱是假的
`localhost:3000`(協定卻是 https,變成一個哪裡都對不上的 URL),不是瀏覽
器實際打的網域。

解法:不要相信 `request.url` 的 host 部分,改用一個明確設定的環境變數
`APP_BASE_URL`,本機跟正式站分別設成各自的網址:

```ts
const redirectUri = new URL("/api/auth/discord/callback", process.env.APP_BASE_URL).toString();
```

這兩個坑的共同教訓是:**「本機測試過、程式邏輯沒問題」不代表在特定
託管平台的執行環境裡行為一致**。Serverless 平台常常會在請求轉發鏈路
中做一些你看不到的處理(或不處理),寫死假設「這在哪裡跑都一樣」的程式碼
就是風險來源。

## 自訂網域:Amplify + Cloudflare DNS

網域的 DNS 是另外在 Cloudflare 管理,要接到 Amplify 需要兩筆 CNAME:一筆
是 ACM 憑證驗證用,一筆是實際導流量用(指到 Amplify 的 CloudFront
distribution)。唯一要注意的是**兩筆都要設成「僅限 DNS」(灰色雲朵,不開
Cloudflare 的橘色代理)**——Amplify 背後本來就是 CloudFront 在做 CDN 和
HTTPS,如果 Cloudflare 的 proxy 再疊一層上去,兩層 CDN/TLS 疊在一起很容
易搞出奇怪的 SSL 或轉址問題,尤其我們還有一個對網址正確性很敏感的 OAuth
流程。

## 心得

這個專案最有價值的部分不是任何一個服務怎麼設定,而是**兩次「本機測試都
過,實際環境才爆炸」的經驗**——一次是爬蟲被 PTT 擋 IP,一次是 Amplify 的
環境變數/URL 解析跟本機行為不一致。教訓都指向同一件事:

- **執行環境本身就是一種依賴**,不管是網路身份(會不會被目標網站擋)還是
  平台的請求轉發機制(環境變數什麼時候生效、Host header 傳不傳得過來),
  這些「平台特性」往往不會寫在你的程式碼裡,卻會決定程式碼在正式環境
  裡到底跑不跑得起來
- 排查問題時,**做「對照組」、看實際的執行環境 log**(這次是 CloudWatch
  Logs)比憑經驗猜更快——兩次踩坑都是先看到含糊的錯誤訊息,查了 log 或
  查了對照組之後才找到真正原因
- 架構要有彈性:發現此路不通之後,通常只需要調整一小塊(換爬蟲的執行位
  置、把猜測的 URL 換成明確設定的環境變數),不用把整個系統重來

## 之後要做的

- AWS Cognito 登入:目前多使用者是靠 Discord OAuth 撐起來的,如果之後想
  支援「不用 Discord 也能用」,或想做付費功能,會需要一套獨立的帳號系統
- (可選)用 EventBridge 排程一個健康檢查 Lambda,監控本機爬蟲多久沒回報,
  太久沒動就發 Discord 警示給自己
