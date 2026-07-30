/**
 * Local test script: fetch PTT MacShop board list page and parse articles.
 * Run with: npx tsx scripts/scrape-macshop.ts
 */
import {
  delay,
  fetchArticleDetail,
  fetchPage,
  findPrevPageUrl,
  parseArticles,
  type Article,
} from "./lib/ptt-scraper.ts";

const BOARD = "MacShop";
const BASE_URL = `https://www.ptt.cc/bbs/${BOARD}/index.html`;
const REQUEST_DELAY_MS = 1500;

/** Fetches the latest board page plus `extraPages` older pages, politely rate-limited. */
async function fetchRecentArticles(extraPages = 0): Promise<Article[]> {
  const all: Article[] = [];
  let pageUrl = BASE_URL;

  for (let i = 0; i <= extraPages; i++) {
    const html = await fetchPage(pageUrl);
    all.push(...parseArticles(html, BOARD));

    if (i < extraPages) {
      const prevUrl = findPrevPageUrl(html);
      if (!prevUrl) break;
      pageUrl = prevUrl;
      await delay(REQUEST_DELAY_MS);
    }
  }

  return all;
}

async function main() {
  const articles = await fetchRecentArticles();
  console.log(`Found ${articles.length} articles (announcements filtered out) on ${BOARD}:\n`);

  for (const article of articles) {
    await delay(REQUEST_DELAY_MS);
    const detail = await fetchArticleDetail(article);
    console.log(`[${detail.pushCount || "-"}] ${detail.title} (${detail.author})`);
    console.log(`  posted: ${detail.postTime || detail.postDate}`);
    console.log(`  ${detail.content.slice(0, 80).replace(/\n/g, " ")}...`);
    console.log(`  ${detail.url}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
