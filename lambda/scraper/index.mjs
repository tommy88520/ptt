import * as cheerio from "cheerio";
import net from "node:net";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const BOARD = "MacShop";
const BASE_URL = `https://www.ptt.cc/bbs/${BOARD}/index.html`;
const ARTICLES_TABLE = process.env.ARTICLES_TABLE ?? "ptt-articles";
const REQUEST_DELAY_MS = 1500;

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ptt-practice-bot/0.1)" },
    });
  } catch (err) {
    console.error("fetch threw:", err, "cause:", err.cause);
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.text();
}

function isAnnouncement(title) {
  return title.startsWith("[公告]");
}

function parseArticles(html) {
  const $ = cheerio.load(html);
  const articles = [];

  $(".r-ent").each((_, el) => {
    const titleEl = $(el).find(".title a");
    const title = titleEl.text().trim();
    const href = titleEl.attr("href");

    if (!title || !href) return;
    if (isAnnouncement(title)) return;

    const articleId = href.split("/").pop()?.replace(".html", "") ?? "";
    const author = $(el).find(".author").text().trim();
    const postDate = $(el).find(".date").text().trim();
    const pushCount = $(el).find(".nrec").text().trim();
    const url = `https://www.ptt.cc${href}`;

    articles.push({ articleId, board: BOARD, title, author, postDate, pushCount, url });
  });

  return articles;
}

async function fetchArticleDetail(article) {
  const html = await fetchPage(article.url);
  const $ = cheerio.load(html);

  const postTime = $(".article-metaline")
    .filter((_, el) => $(el).find(".article-meta-tag").text().trim() === "時間")
    .find(".article-meta-value")
    .text()
    .trim();

  const mainContent = $("#main-content").clone();
  mainContent.find(".article-metaline, .article-metaline-right, .push").remove();
  const content = mainContent.text().replace(/^--\s*$[\s\S]*/m, "").trim();

  return { ...article, content, postTime: postTime || article.postDate };
}

async function articleExists(articleId) {
  const res = await ddb.send(
    new GetCommand({
      TableName: ARTICLES_TABLE,
      Key: { articleId },
      ProjectionExpression: "articleId",
    })
  );
  return Boolean(res.Item);
}

async function saveArticle(detail) {
  await ddb.send(
    new PutCommand({
      TableName: ARTICLES_TABLE,
      Item: { ...detail, scrapedAt: new Date().toISOString() },
      // Avoids a duplicate write (and a duplicate notification, once notifications exist)
      // if two scrape runs somehow overlap.
      ConditionExpression: "attribute_not_exists(articleId)",
    })
  );
}

function testTelnetConnect(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(`TIMEOUT after ${timeoutMs}ms`);
    }, timeoutMs);

    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve("CONNECTED");
    });
    socket.once("data", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve("CONNECTED (received data)");
    });
    socket.once("error", (err) => {
      clearTimeout(timer);
      resolve(`ERROR: ${err.code ?? err.message}`);
    });
  });
}

export const handler = async () => {
  if (process.env.DEBUG_CONNECTIVITY) {
    const telnetResult = await testTelnetConnect("bbs.ptt.cc", 23);
    console.log("bbs.ptt.cc:23 telnet:", telnetResult);
    try {
      await fetchPage("https://www.google.com");
      console.log("google.com: OK");
    } catch (e) {
      console.log("google.com: FAILED", e.cause ?? e.message);
    }
    try {
      await fetchPage(BASE_URL);
      console.log("ptt.cc: OK");
    } catch (e) {
      console.log("ptt.cc: FAILED", e.cause ?? e.message);
    }
    return { debug: true };
  }

  const html = await fetchPage(BASE_URL);
  const listed = parseArticles(html);

  const newArticles = [];
  for (const article of listed) {
    if (!(await articleExists(article.articleId))) {
      newArticles.push(article);
    }
  }

  const saved = [];
  for (const article of newArticles) {
    await delay(REQUEST_DELAY_MS);
    const detail = await fetchArticleDetail(article);
    try {
      await saveArticle(detail);
      saved.push(detail.articleId);
    } catch (err) {
      if (err.name !== "ConditionalCheckFailedException") throw err;
      // Another concurrent run already saved it first; not an error.
    }
  }

  const result = { checked: listed.length, new: newArticles.length, saved: saved.length };
  console.log(JSON.stringify(result));
  return result;
};
