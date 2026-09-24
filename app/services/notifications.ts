import "server-only";
import type { NewArticle } from "@/app/services/articles";
import { findSubscriptionsForTitle } from "@/app/services/subscriptions";

const RETRIES = 3;
const RETRY_DELAY_MS = 3000;

async function postWebhook(webhookUrl: string, content: string): Promise<void> {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, allowed_mentions: { parse: ["users"] } }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return;
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt === RETRIES) {
        console.error(`[Discord 通知失敗，已重試 ${RETRIES} 次，放棄] ${err}`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

export async function notifySubscribers(article: NewArticle): Promise<void> {
  const matches = await findSubscriptionsForTitle(article.title);
  if (matches.length === 0) return;

  const keywords = [...new Set(matches.map((m) => (m.category ? `${m.keyword}（${m.category}）` : m.keyword)))];
  const mentions = [...new Set(matches.map((m) => `<@${m.userId}>`))];
  const content = `🔔 PTT ${article.board} 新文章符合「${keywords.join("、")}」 ${mentions.join(" ")}\n${article.title}\n${article.url}`;

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log(`[Discord webhook 未設定，改印在 log] ${content}`);
    return;
  }
  await postWebhook(webhookUrl, content);
}
