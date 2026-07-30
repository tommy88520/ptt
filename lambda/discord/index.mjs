import { InteractionResponseType, InteractionType, verifyKey } from "discord-interactions";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE ?? "ptt-subscriptions";
const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const EPHEMERAL = 64; // only the invoking user sees the reply

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

function getHeader(headers, name) {
  const key = Object.keys(headers ?? {}).find((k) => k.toLowerCase() === name);
  return key ? headers[key] : undefined;
}

function reply(content) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content, flags: EPHEMERAL },
    }),
  };
}

async function handleSubscribe(userId, keyword) {
  await ddb.send(
    new PutCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      Item: { userId, keyword, active: true, createdAt: new Date().toISOString() },
    })
  );
  return reply(`已訂閱關鍵字「${keyword}」，MacShop 板有符合的新文章會私訊通知你。`);
}

async function handleUnsubscribe(userId, keyword) {
  await ddb.send(
    new DeleteCommand({ TableName: SUBSCRIPTIONS_TABLE, Key: { userId, keyword } })
  );
  return reply(`已取消訂閱關鍵字「${keyword}」。`);
}

async function handleList(userId) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    })
  );
  const keywords = res.Items.map((item) => item.keyword);
  return reply(keywords.length ? `你目前訂閱的關鍵字：${keywords.join("、")}` : "你目前沒有訂閱任何關鍵字。");
}

export const handler = async (event) => {
  const signature = getHeader(event.headers, "x-signature-ed25519");
  const timestamp = getHeader(event.headers, "x-signature-timestamp");
  const rawBody = event.body ?? "";

  const isValid =
    signature && timestamp && (await verifyKey(rawBody, signature, timestamp, DISCORD_PUBLIC_KEY));
  if (!isValid) {
    return { statusCode: 401, body: JSON.stringify({ error: "Invalid request signature" }) };
  }

  const interaction = JSON.parse(rawBody);

  if (interaction.type === InteractionType.PING) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: InteractionResponseType.PONG }),
    };
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const userId = interaction.member?.user?.id ?? interaction.user?.id;
    const commandName = interaction.data.name;
    const keywordOption = interaction.data.options?.find((o) => o.name === "keyword");
    const keyword = keywordOption?.value?.trim().toLowerCase();

    if (commandName === "subscribe" && keyword) return handleSubscribe(userId, keyword);
    if (commandName === "unsubscribe" && keyword) return handleUnsubscribe(userId, keyword);
    if (commandName === "subscriptions") return handleList(userId);

    return reply("不支援的指令。");
  }

  return { statusCode: 400, body: JSON.stringify({ error: "Unhandled interaction type" }) };
};
