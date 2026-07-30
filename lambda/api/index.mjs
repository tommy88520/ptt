import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const ARTICLES_TABLE = process.env.ARTICLES_TABLE ?? "ptt-articles";
const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE ?? "ptt-subscriptions";
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const BOARD_INDEX = "board-articleId-index";
const DEFAULT_BOARD = "MacShop";
const REQUIRED_FIELDS = ["articleId", "board", "title", "author", "url"];

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,x-api-key",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}

async function findMatchingSubscribers(title) {
  const lowerTitle = title.toLowerCase();
  const result = await ddb.send(
    new ScanCommand({ TableName: SUBSCRIPTIONS_TABLE, FilterExpression: "active = :active", ExpressionAttributeValues: { ":active": true } })
  );
  return result.Items.filter((sub) => lowerTitle.includes(sub.keyword)).map((sub) => sub.userId);
}

async function sendDiscordDm(userId, content) {
  const channelRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_id: userId }),
  });
  if (!channelRes.ok) {
    console.error(`Failed to open DM channel for ${userId}: ${channelRes.status}`);
    return;
  }
  const channel = await channelRes.json();

  const messageRes = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!messageRes.ok) {
    console.error(`Failed to send DM to ${userId}: ${messageRes.status}`);
  }
}

async function notifySubscribers(article) {
  const userIds = await findMatchingSubscribers(article.title);
  await Promise.all(
    userIds.map((userId) =>
      sendDiscordDm(userId, `PTT ${article.board} 新文章符合你的訂閱關鍵字：\n${article.title}\n${article.url}`)
    )
  );
}

async function handleCreateArticle(event) {
  let payload;
  try {
    payload = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const missing = REQUIRED_FIELDS.filter((field) => !payload[field]);
  if (missing.length > 0) {
    return json(400, { error: `Missing required fields: ${missing.join(", ")}` });
  }

  try {
    await ddb.send(
      new PutCommand({
        TableName: ARTICLES_TABLE,
        Item: { ...payload, scrapedAt: new Date().toISOString() },
        ConditionExpression: "attribute_not_exists(articleId)",
      })
    );
    await notifySubscribers(payload);
    return json(201, { saved: true, articleId: payload.articleId });
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return json(200, { saved: false, reason: "already exists", articleId: payload.articleId });
    }
    throw err;
  }
}

async function handleListArticles(event) {
  const params = event.queryStringParameters ?? {};
  const board = params.board || DEFAULT_BOARD;
  const keyword = params.keyword?.trim();
  const limit = Math.min(Number(params.limit) || 20, 100);

  const queryInput = {
    TableName: ARTICLES_TABLE,
    IndexName: BOARD_INDEX,
    KeyConditionExpression: "board = :board",
    ExpressionAttributeValues: { ":board": board },
    ScanIndexForward: false, // newest first (articleId embeds a timestamp)
    Limit: keyword ? undefined : limit,
  };

  if (keyword) {
    queryInput.FilterExpression = "contains(title, :keyword)";
    queryInput.ExpressionAttributeValues[":keyword"] = keyword;
  }

  const result = await ddb.send(new QueryCommand(queryInput));
  const items = keyword ? result.Items.slice(0, limit) : result.Items;

  return json(200, { board, keyword: keyword ?? null, count: items.length, items });
}

async function handleSubscribe(event) {
  let payload;
  try {
    payload = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  const { userId, keyword } = payload;
  if (!userId || !keyword) {
    return json(400, { error: "userId and keyword are required" });
  }

  await ddb.send(
    new PutCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      Item: { userId, keyword: keyword.trim().toLowerCase(), active: true, createdAt: new Date().toISOString() },
    })
  );
  return json(201, { subscribed: true, keyword: keyword.trim().toLowerCase() });
}

async function handleUnsubscribe(event) {
  let payload;
  try {
    payload = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  const { userId, keyword } = payload;
  if (!userId || !keyword) {
    return json(400, { error: "userId and keyword are required" });
  }

  await ddb.send(
    new DeleteCommand({ TableName: SUBSCRIPTIONS_TABLE, Key: { userId, keyword: keyword.trim().toLowerCase() } })
  );
  return json(200, { unsubscribed: true, keyword: keyword.trim().toLowerCase() });
}

async function handleListSubscriptions(event) {
  const userId = event.queryStringParameters?.userId;
  if (!userId) {
    return json(400, { error: "userId query parameter is required" });
  }

  const result = await ddb.send(
    new QueryCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    })
  );
  return json(200, { userId, items: result.Items });
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? event.httpMethod;
  const resource = event.resource ?? event.path;

  try {
    if (method === "OPTIONS") return json(200, {});

    if (resource === "/subscriptions") {
      if (method === "GET") return await handleListSubscriptions(event);
      if (method === "POST") return await handleSubscribe(event);
      if (method === "DELETE") return await handleUnsubscribe(event);
      return json(405, { error: "Method not allowed" });
    }

    if (method === "POST") return await handleCreateArticle(event);
    if (method === "GET") return await handleListArticles(event);
    return json(405, { error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return json(500, { error: "Internal server error" });
  }
};
