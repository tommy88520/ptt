import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const ARTICLES_TABLE = process.env.ARTICLES_TABLE ?? "ptt-articles";
const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE ?? "ptt-subscriptions";
const RATE_LIMIT_TABLE = process.env.RATE_LIMIT_TABLE ?? "ptt-rate-limits";
const PAGE_VIEWS_TABLE = process.env.PAGE_VIEWS_TABLE ?? "ptt-page-views";
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const OWNER_DISCORD_ID = process.env.OWNER_DISCORD_ID;
const DAILY_NOTIFICATION_LIMIT = 20;
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

/**
 * Owner has unlimited notifications; everyone else is capped per calendar day (UTC).
 * Returns "allowed" (send the article notice), "notify-limit" (send a one-time
 * "you've hit today's cap" notice instead), or "blocked" (send nothing).
 */
async function tryConsumeNotificationQuota(userId) {
  if (userId === OWNER_DISCORD_ID) return "allowed";

  const today = new Date().toISOString().slice(0, 10);
  const ttl = Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60; // auto-expire the counter after 2 days

  try {
    await ddb.send(
      new UpdateCommand({
        TableName: RATE_LIMIT_TABLE,
        Key: { userId, date: today },
        UpdateExpression: "SET #count = if_not_exists(#count, :zero) + :one, #ttl = if_not_exists(#ttl, :ttl)",
        ConditionExpression: "attribute_not_exists(#count) OR #count < :limit",
        ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":zero": 0,
          ":one": 1,
          ":limit": DAILY_NOTIFICATION_LIMIT,
          ":ttl": ttl,
        },
      })
    );
    return "allowed";
  } catch (err) {
    if (err.name !== "ConditionalCheckFailedException") throw err;
  }

  // Over the limit - tell them exactly once, then stay silent for the rest of the day.
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: RATE_LIMIT_TABLE,
        Key: { userId, date: today },
        UpdateExpression: "SET limitNotified = :true",
        ConditionExpression: "attribute_not_exists(limitNotified)",
        ExpressionAttributeValues: { ":true": true },
      })
    );
    return "notify-limit";
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") return "blocked";
    throw err;
  }
}

async function notifySubscribers(article) {
  const userIds = await findMatchingSubscribers(article.title);
  await Promise.all(
    userIds.map(async (userId) => {
      const status = await tryConsumeNotificationQuota(userId);
      if (status === "blocked") return;
      if (status === "notify-limit") {
        await sendDiscordDm(
          userId,
          `你今天的通知已達每日上限(${DAILY_NOTIFICATION_LIMIT} 篇),之後符合的新文章要等明天才會再通知你。`
        );
        return;
      }
      await sendDiscordDm(userId, `PTT ${article.board} 新文章符合你的訂閱關鍵字：\n${article.title}\n${article.url}`);
    })
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

async function handleRecordPageView(event) {
  let payload;
  try {
    payload = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  const path = payload.path;
  if (!path) {
    return json(400, { error: "path is required" });
  }

  const today = new Date().toISOString().slice(0, 10);
  await ddb.send(
    new UpdateCommand({
      TableName: PAGE_VIEWS_TABLE,
      Key: { path, date: today },
      UpdateExpression: "SET #count = if_not_exists(#count, :zero) + :one",
      ExpressionAttributeNames: { "#count": "count" },
      ExpressionAttributeValues: { ":zero": 0, ":one": 1 },
    })
  );
  return json(204, {});
}

async function handleListPageViews(event) {
  const path = event.queryStringParameters?.path;
  if (!path) {
    return json(400, { error: "path query parameter is required" });
  }

  const result = await ddb.send(
    new QueryCommand({
      TableName: PAGE_VIEWS_TABLE,
      KeyConditionExpression: "#path = :path",
      ExpressionAttributeNames: { "#path": "path" },
      ExpressionAttributeValues: { ":path": path },
      ScanIndexForward: false,
    })
  );
  const total = result.Items.reduce((sum, item) => sum + item.count, 0);
  return json(200, { path, total, byDate: result.Items });
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

    if (resource === "/pageviews") {
      if (method === "POST") return await handleRecordPageView(event);
      if (method === "GET") return await handleListPageViews(event);
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
