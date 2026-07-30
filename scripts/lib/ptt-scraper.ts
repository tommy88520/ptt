import * as cheerio from "cheerio";

export interface Article {
  articleId: string;
  board: string;
  title: string;
  author: string;
  postDate: string;
  pushCount: string;
  url: string;
}

export interface ArticleDetail extends Article {
  content: string;
  postTime: string;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ptt-practice-bot/0.1)" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.text();
}

export function isAnnouncement(title: string): boolean {
  return title.startsWith("[公告]");
}

export function parseArticles(html: string, board: string): Article[] {
  const $ = cheerio.load(html);
  const articles: Article[] = [];

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

    articles.push({ articleId, board, title, author, postDate, pushCount, url });
  });

  return articles;
}

/** Finds the "‹ 上頁" (previous/older page) link on a board index page. */
export function findPrevPageUrl(html: string): string | null {
  const $ = cheerio.load(html);
  const prevLink = $(".btn-group-paging a")
    .filter((_, el) => $(el).text().includes("上頁"))
    .attr("href");
  return prevLink ? `https://www.ptt.cc${prevLink}` : null;
}

export async function fetchArticleDetail(article: Article): Promise<ArticleDetail> {
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
