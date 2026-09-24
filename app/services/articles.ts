import "server-only";
import { db } from "@/app/lib/db";

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

export async function listArticles(options: { board: string; keyword?: string; limit: number }): Promise<Article[]> {
  const { board, keyword, limit } = options;
  const { rows } = keyword
    ? await db.query<ArticleRow>(
        `SELECT * FROM articles
         WHERE board = $1 AND strpos(lower(title), lower($2)) > 0
         ORDER BY article_id DESC LIMIT $3`,
        [board, keyword, limit]
      )
    : await db.query<ArticleRow>(`SELECT * FROM articles WHERE board = $1 ORDER BY article_id DESC LIMIT $2`, [
        board,
        limit,
      ]);
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
