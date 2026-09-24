import "server-only";
import { db } from "@/app/lib/db";
import type { NewArticle } from "@/app/services/articles";
import { findSubscribersForTitle } from "@/app/services/subscriptions";

const DAILY_NOTIFICATION_LIMIT = 20;

type QuotaStatus = "allowed" | "notify-limit" | "blocked";

async function sendDiscordDm(userId: string, content: string): Promise<void> {
  const headers = { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" };

  const channelRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers,
    body: JSON.stringify({ recipient_id: userId }),
  });
  if (!channelRes.ok) {
    console.error(`Failed to open DM channel for ${userId}: ${channelRes.status}`);
    return;
  }
  const channel = (await channelRes.json()) as { id: string };

  const messageRes = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ content }),
  });
  if (!messageRes.ok) {
    console.error(`Failed to send DM to ${userId}: ${messageRes.status}`);
  }
}

/** 擁有者不限次數；其他人每天（UTC）上限 20 篇，超過時只提醒一次，之後當天靜默 */
async function tryConsumeNotificationQuota(userId: string): Promise<QuotaStatus> {
  if (userId === process.env.OWNER_DISCORD_ID) return "allowed";

  const consumed = await db.query(
    `INSERT INTO rate_limits (user_id, date, count) VALUES ($1, (now() AT TIME ZONE 'UTC')::date, 1)
     ON CONFLICT (user_id, date) DO UPDATE SET count = rate_limits.count + 1
     WHERE rate_limits.count < $2`,
    [userId, DAILY_NOTIFICATION_LIMIT]
  );
  if (consumed.rowCount === 1) return "allowed";

  const flagged = await db.query(
    `UPDATE rate_limits SET limit_notified = true
     WHERE user_id = $1 AND date = (now() AT TIME ZONE 'UTC')::date AND NOT limit_notified`,
    [userId]
  );
  return flagged.rowCount === 1 ? "notify-limit" : "blocked";
}

export async function notifySubscribers(article: NewArticle): Promise<void> {
  if (!process.env.DISCORD_BOT_TOKEN) return;
  const userIds = await findSubscribersForTitle(article.title);
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
