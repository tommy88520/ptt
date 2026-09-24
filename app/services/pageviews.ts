import "server-only";
import { db } from "@/app/lib/db";

export async function incrementPageView(path: string): Promise<void> {
  await db.query(
    `INSERT INTO page_views (path, date, count) VALUES ($1, (now() AT TIME ZONE 'UTC')::date, 1)
     ON CONFLICT (path, date) DO UPDATE SET count = page_views.count + 1`,
    [path]
  );
}
