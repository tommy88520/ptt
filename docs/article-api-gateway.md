# 從 Next.js 開發者的角度理解 AWS API Gateway + Lambda

## 一個讓我卡住的瞬間

我在 AWS 上用 CLI 建了一個 API,流程大概是這樣:

```bash
aws apigateway create-rest-api --name ptt-articles-api
aws apigateway create-resource --path-part articles ...
aws apigateway put-method --http-method POST --api-key-required ...
aws apigateway put-integration --type AWS_PROXY --uri "...lambda.../invocations" ...
aws lambda add-permission --action lambda:InvokeFunction --principal apigateway.amazonaws.com ...
aws apigateway create-deployment --stage-name prod
```

六個指令,才把一個 `POST /articles` 端點串起來。而我平常在 Next.js 裡做
同樣的事,是這樣:

```ts
// app/api/articles/route.ts
export async function POST(req: Request) {
  const body = await req.json();
  // ...寫入資料庫
  return Response.json({ saved: true });
}
```

新增一個檔案,搞定。

第一次看到 AWS 那邊要拆成這麼多步驟,直覺反應是「這也太麻煩了吧」。但拆開
來看之後,會發現這其實是兩種完全不同的心智模型,理解了這個差異,AWS 的
serverless 服務就沒那麼難懂了。

## 傳統模型:框架幫你把路由和邏輯包在一起

Next.js、Express、Django、Rails——這些框架的共同點是:它們是一個**持續運
行的 process**,啟動的時候就把所有路由註冊好,一個請求進來,框架內部的
router 決定要交給哪個 handler,handler 執行完直接回應。

路由規則(這個路徑對應哪個函式)、認證邏輯、業務邏輯,全部活在同一個程式
碼庫、同一個執行環境裡。你不需要知道底層 TCP 連線怎麼建立、HTTP 標頭怎麼
解析——框架都處理掉了,你只需要寫 handler。

## AWS 的模型:兩個互不知道對方存在的服務

AWS 把這些職責拆成獨立的、可以分開計費、分開擴展的服務:

| | 負責什麼 | 不負責什麼 |
|---|---|---|
| **API Gateway** | 接收 HTTP 請求、比對路徑/方法、驗證 API Key 或 Token、限流、CORS | 完全不執行你的業務邏輯 |
| **Lambda** | 執行一段程式碼,收到輸入、回傳輸出 | 完全不懂什麼是 HTTP、URL、路由 |

關鍵的心態轉換是:**Lambda 不是一個 API,它只是一個函式**。它不知道自己
是被誰呼叫的。同一個 Lambda 函式,可以:

- 被 API Gateway 呼叫,處理一個 HTTP 請求
- 被 EventBridge 排程呼叫,每小時執行一次背景工作
- 被 S3 事件呼叫,某個檔案上傳後自動觸發
- 被另一個 Lambda 直接呼叫

「這個函式要怎麼被觸發」跟「這個函式做什麼事」是兩件完全獨立的事情,中間
靠**你自己去設定的「整合」(integration)**接起來。API Gateway 只是眾多
可能的觸發來源之一。

回頭看前面那六個指令,其實對應到的正是這個模型:

1. `create-rest-api` / `create-resource` / `put-method`——這是在設定
   **API Gateway 這一側**:什麼路徑、什麼方法、要不要驗證
2. `put-integration`——**把這個路徑接到某個 Lambda**,這一步是兩個獨立
   服務真正「連起來」的地方
3. `lambda add-permission`——**明確授權** API Gateway 可以呼叫這個
   Lambda。在 Next.js 裡,路由跟 handler 天生就在同一個信任邊界內,不需
   要額外授權;但 API Gateway 和 Lambda 是兩個獨立的 AWS 服務,預設互相
   不信任,一定要顯式給權限,這也是 AWS IAM 權限模型「預設拒絕」精神的
   體現
4. `create-deployment`——API Gateway 的設定變更,要「部署」到一個
   stage(例如 `prod`)才會真正生效,有點像是你改了 Next.js 的路由設定,
   但要重新 build/deploy 才會反映到正式站

## 為什麼要拆成這樣,而不是包成一體?

**獨立擴展、獨立計費。** API Gateway 處理 TLS 握手、大量並發連線的能力,
跟你 Lambda 裡的業務邏輯完全脫鉤。就算你的邏輯很慢,也不影響 API Gateway
同時應付其他請求的能力。計費也拆成兩段:API Gateway 按請求數收費,Lambda
按「執行時間 × 記憶體」收費——你可以清楚看到成本花在哪一層。

**沒有「常駐伺服器」這回事。** Next.js app 是一個持續運行的 process,兩次
請求之間,記憶體裡的變數還在。Lambda 每次執行可能是全新的執行環境,函式
執行完就可能被回收,不保留任何狀態。這正是它能做到「沒人呼叫、完全不跑、
完全不計費」的原因——但也代表你不能依賴 Lambda 裡的全域變數在兩次呼叫之
間保持一致(連線池是常見例外,SDK client 通常會在 handler 外面初始化來重
複利用)。

**同一個函式可以插在不同觸發源後面。** 這是我覺得最不直覺,但想通了很有用
的一點。我們專案裡的 `ptt-articles-api` 這個 Lambda,現在是被 API Gateway
呼叫,但如果哪天不想要 HTTP 端點了,改成讓 EventBridge 直接排程呼叫,
Lambda 裡的程式碼幾乎不用改——因為它從來就不是「一個 API」,它只是「一段
函式邏輯」。

## 代價:設定的顆粒度變細了

好處講完了,代價也要老實說:**同樣的功能,設定步驟明顯變多**。Next.js 裡
新增一個路由是加一個檔案;AWS 這邊是路徑、方法、整合、權限、部署,五個
獨立的資源,要自己一個一個串起來,而且哪個環節漏了(最常見的是忘記
`lambda add-permission`)整條路就是打不通,錯誤訊息通常也不會直接告訴你
「你漏了這一步」。

這也是為什麼實務上大型專案不會像我們這樣手動下 CLI 指令,而是用
Infrastructure as Code 工具(Terraform、AWS CDK、SAM)把這些資源定義成
程式碼,一次套用、版本控制、可以重複建置——但理解「底層到底在幫你做什
麼」,是能不能用好這些工具的前提,這也是我這次選擇先手動用 CLI 一步步建
的原因。

## 心智模型對照表

| 你熟悉的(Next.js / Express) | AWS 對應 |
|---|---|
| 框架的路由系統 | API Gateway 的 resource + method |
| middleware(認證、限流) | API Gateway 的 API Key / Usage Plan / Authorizer |
| route handler 函式 | Lambda 函式 |
| 一直開著的 server process | 完全沒有,Lambda 用完即丟 |
| 部署整個 app | 部署 API Gateway 的 stage + 更新 Lambda 程式碼(兩件事) |

理解這張表之後,再回頭看 AWS 文件或別人的 CDK/Terraform 設定檔,會發現
其實都是在描述同樣這幾塊拼圖,只是換了一種說法。
