import "server-only";
import { db } from "@/app/lib/db";
import { CATEGORY_TITLE_PATTERNS, type Category } from "@/app/services/categories";

export interface Article {
  articleId: string;
  board: string;
  title: string;
  author: string;
  postDate: string;
  postTime: string;
  pushCount: string;
  url: string;
  content: string;
  scrapedAt: string;
}

export type NewArticle = Omit<Article, "scrapedAt">;

interface ArticleRow {
  article_id: string;
  board: string;
  title: string;
  author: string;
  post_date: string;
  post_time: string;
  push_count: string;
  url: string;
  content: string;
  scraped_at: Date;
}

function toArticle(row: ArticleRow): Article {
  return {
    articleId: row.article_id,
    board: row.board,
    title: row.title,
    author: row.author,
    postDate: row.post_date,
    postTime: row.post_time,
    pushCount: row.push_count,
    url: row.url,
    content: row.content,
    scrapedAt: row.scraped_at.toISOString(),
  };
}

export async function listArticles(options: {
  board: string;
  keyword?: string;
  category?: Category;
  limit: number;
}): Promise<Article[]> {
  const { board, keyword, category, limit } = options;
  const params: (string | number)[] = [board];
  const conditions = ["board = $1"];

  if (keyword) {
    params.push(keyword);
    conditions.push(`strpos(lower(title), lower($${params.length})) > 0`);
  }
  if (category) {
    params.push(CATEGORY_TITLE_PATTERNS[category]);
    conditions.push(`title ~ $${params.length}`);
  }
  params.push(limit);

  const { rows } = await db.query<ArticleRow>(
    `SELECT * FROM articles WHERE ${conditions.join(" AND ")} ORDER BY article_id DESC LIMIT $${params.length}`,
    params
  );
  return rows.map(toArticle);
}

/** 回傳 true 代表是新文章、已寫入；false 代表之前就存過了 */
export async function insertArticle(article: NewArticle): Promise<boolean> {
  const { rowCount } = await db.query(
    `INSERT INTO articles (article_id, board, title, author, post_date, post_time, push_count, url, content)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (article_id) DO NOTHING`,
    [
      article.articleId,
      article.board,
      article.title,
      article.author,
      article.postDate,
      article.postTime,
      article.pushCount,
      article.url,
      article.content,
    ]
  );
  return rowCount === 1;
}
