import "server-only";
import { db } from "@/app/lib/db";

export interface Subscription {
  userId: string;
  keyword: string;
  active: boolean;
  createdAt: string;
}

interface SubscriptionRow {
  user_id: string;
  keyword: string;
  active: boolean;
  created_at: Date;
}

export function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase();
}

export async function listSubscriptions(userId: string): Promise<Subscription[]> {
  const { rows } = await db.query<SubscriptionRow>(
    "SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at",
    [userId]
  );
  return rows.map((row) => ({
    userId: row.user_id,
    keyword: row.keyword,
    active: row.active,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function subscribe(userId: string, keyword: string): Promise<void> {
  await db.query(
    `INSERT INTO subscriptions (user_id, keyword) VALUES ($1, $2)
     ON CONFLICT (user_id, keyword) DO UPDATE SET active = true`,
    [userId, normalizeKeyword(keyword)]
  );
}

export async function unsubscribe(userId: string, keyword: string): Promise<void> {
  await db.query("DELETE FROM subscriptions WHERE user_id = $1 AND keyword = $2", [userId, normalizeKeyword(keyword)]);
}

export async function findSubscribersForTitle(title: string): Promise<string[]> {
  const { rows } = await db.query<{ user_id: string }>(
    "SELECT DISTINCT user_id FROM subscriptions WHERE active AND strpos(lower($1), keyword) > 0",
    [title]
  );
  return rows.map((row) => row.user_id);
}
