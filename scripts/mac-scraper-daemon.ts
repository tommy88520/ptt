/**
 * Runs one scrape cycle: fetch the PTT MacShop board list, skip articles
 * already known to the API, fetch full detail for new ones, and POST them.
 *
 * Meant to be invoked on a schedule (launchd) from a machine PTT doesn't
 * block, since AWS's own IP ranges are blocked. See lambda/api for the
 * receiving end.
 *
 * Run with: node --env-file=.env.local scripts/mac-scraper-daemon.ts
 * (requires tsx as the loader; see the npm script in package.json)
 */
import { delay, fetchArticleDetail, fetchPage, parseArticles, type Article } from "./lib/ptt-scraper.ts";

const BOARD = "MacShop";
const BASE_URL = `https://www.ptt.cc/bbs/${BOARD}/index.html`;
const REQUEST_DELAY_MS = 1500;

const API_BASE_URL = requireEnv("PTT_API_BASE_URL");
const API_KEY = requireEnv("PTT_API_KEY");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function fetchKnownArticleIds(board: string): Promise<Set<string>> {
  const url = `${API_BASE_URL}/articles?board=${encodeURIComponent(board)}&limit=100`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch known articles: ${res.status}`);
  }
  const data = (await res.json()) as { items: { articleId: string }[] };
  return new Set(data.items.map((item) => item.articleId));
}

async function postArticle(detail: Awaited<ReturnType<typeof fetchArticleDetail>>) {
  const res = await fetch(`${API_BASE_URL}/articles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify(detail),
  });
  if (!res.ok) {
    throw new Error(`Failed to POST article ${detail.articleId}: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  const [html, knownIds] = await Promise.all([fetchPage(BASE_URL), fetchKnownArticleIds(BOARD)]);
  const listed: Article[] = parseArticles(html, BOARD);
  const newArticles = listed.filter((a) => !knownIds.has(a.articleId));

  let saved = 0;
  for (const article of newArticles) {
    await delay(REQUEST_DELAY_MS);
    const detail = await fetchArticleDetail(article);
    const result = await postArticle(detail);
    console.log(`[${new Date().toISOString()}] ${detail.title} -> ${JSON.stringify(result)}`);
    saved++;
  }

  console.log(
    `[${new Date().toISOString()}] done. checked=${listed.length} new=${newArticles.length} saved=${saved}`
  );
}

main().catch((err) => {
  console.error(`[${new Date().toISOString()}] scrape cycle failed:`, err);
  process.exit(1);
});
