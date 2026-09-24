/**
 * 把當初從 DynamoDB 匯出的 JSON（backups/，2026-09-24 搬家時的最後一份）匯入 Postgres。
 * 每張表自動挑 backups/ 裡最新的那份；可重複執行（已存在的列會略過）。
 *
 * 用法：node --env-file=.env.local --experimental-strip-types scripts/import-backup.ts
 */
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

type Item = Record<string, unknown>;

const BACKUP_DIR = new URL("../backups/", import.meta.url);

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function loadLatest(table: string): Promise<Item[]> {
  const files = (await readdir(BACKUP_DIR)).filter((f) => f.startsWith(`${table}.`) && f.endsWith(".json")).sort();
  const latest = files.at(-1);
  if (!latest) {
    console.log(`${table}: 沒有備份檔，略過`);
    return [];
  }
  console.log(`${table}: 讀取 ${latest}`);
  return JSON.parse(await readFile(new URL(latest, BACKUP_DIR), "utf8")) as Item[];
}

async function main(): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("BEGIN");

    let inserted = 0;
    const articles = await loadLatest("ptt-articles");
    for (const a of articles) {
      const res = await client.query(
        `INSERT INTO articles (article_id, board, title, author, post_date, post_time, push_count, url, content, scraped_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, now()))
         ON CONFLICT (article_id) DO NOTHING`,
        [
          str(a.articleId),
          str(a.board),
          str(a.title),
          str(a.author),
          str(a.postDate),
          str(a.postTime),
          str(a.pushCount),
          str(a.url),
          str(a.content),
          str(a.scrapedAt) || null,
        ]
      );
      inserted += res.rowCount ?? 0;
    }
    console.log(`  articles: ${inserted}/${articles.length} 筆新增`);

    inserted = 0;
    const subscriptions = await loadLatest("ptt-subscriptions");
    for (const s of subscriptions) {
      const res = await client.query(
        `INSERT INTO subscriptions (user_id, keyword, active, created_at)
         VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()))
         ON CONFLICT (user_id, keyword) DO NOTHING`,
        [str(s.userId), str(s.keyword), s.active !== false, str(s.createdAt) || null]
      );
      inserted += res.rowCount ?? 0;
    }
    console.log(`  subscriptions: ${inserted}/${subscriptions.length} 筆新增`);

    inserted = 0;
    const pageViews = await loadLatest("ptt-page-views");
    for (const p of pageViews) {
      const res = await client.query(
        `INSERT INTO page_views (path, date, count) VALUES ($1, $2::date, $3)
         ON CONFLICT (path, date) DO NOTHING`,
        [str(p.path), str(p.date), Number(p.count) || 0]
      );
      inserted += res.rowCount ?? 0;
    }
    console.log(`  page_views: ${inserted}/${pageViews.length} 筆新增`);

    // rate_limits 只是當天的通知計數（原本兩天就 TTL 清掉），不搬
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
