import "server-only";
import { db } from "@/app/lib/db";
import { parseCategory, titleMatchesCategory, type Category } from "@/app/services/categories";

export interface Subscription {
  userId: string;
  keyword: string;
  category: Category;
  active: boolean;
  createdAt: string;
}

interface SubscriptionRow {
  user_id: string;
  keyword: string;
  category: string;
  active: boolean;
  created_at: Date;
}

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    userId: row.user_id,
    keyword: row.keyword,
    category: parseCategory(row.category),
    active: row.active,
    createdAt: row.created_at.toISOString(),
  };
}

export function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase();
}

export async function listSubscriptions(userId: string): Promise<Subscription[]> {
  const { rows } = await db.query<SubscriptionRow>(
    "SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at",
    [userId]
  );
  return rows.map(toSubscription);
}

export async function subscribe(userId: string, keyword: string, category: Category): Promise<void> {
  await db.query(
    `INSERT INTO subscriptions (user_id, keyword, category) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, keyword, category) DO UPDATE SET active = true`,
    [userId, normalizeKeyword(keyword), category]
  );
}

export async function unsubscribe(userId: string, keyword: string, category: Category): Promise<void> {
  await db.query("DELETE FROM subscriptions WHERE user_id = $1 AND keyword = $2 AND category = $3", [
    userId,
    normalizeKeyword(keyword),
    category,
  ]);
}

export async function findSubscriptionsForTitle(title: string): Promise<Subscription[]> {
  const { rows } = await db.query<SubscriptionRow>(
    "SELECT * FROM subscriptions WHERE active AND strpos(lower($1), keyword) > 0",
    [title]
  );
  return rows.map(toSubscription).filter((sub) => titleMatchesCategory(title, sub.category));
}
