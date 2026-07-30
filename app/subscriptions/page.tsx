import type { Metadata } from "next";
import { getSession } from "@/app/lib/session";
import { subscribeAction, unsubscribeAction } from "@/app/actions/subscriptions";
import { recordPageView } from "@/app/lib/pageview";

export const metadata: Metadata = {
  title: "訂閱管理｜PTT MacShop 雷達",
  description: "用 Discord 帳號登入,訂閱 PTT MacShop 版關鍵字(例如 iPhone、MacBook),符合的新文章立即私訊通知你。",
};

interface Subscription {
  userId: string;
  keyword: string;
  active: boolean;
  createdAt: string;
}

interface Article {
  articleId: string;
  title: string;
  author: string;
  postDate: string;
  postTime: string;
  pushCount: string;
  url: string;
}

async function fetchSubscriptions(userId: string): Promise<Subscription[]> {
  const url = new URL(`${process.env.PTT_API_BASE_URL}/subscriptions`);
  url.searchParams.set("userId", userId);

  const res = await fetch(url, {
    headers: { "x-api-key": process.env.PTT_WEB_API_KEY! },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch subscriptions: ${res.status}`);
  }
  const data = (await res.json()) as { items: Subscription[] };
  return data.items;
}

async function fetchArticlesForKeyword(keyword: string): Promise<Article[]> {
  const url = new URL(`${process.env.PTT_API_BASE_URL}/articles`);
  url.searchParams.set("board", "MacShop");
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("limit", "10");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { items: Article[] };
  return data.items;
}

export default async function SubscriptionsPage() {
  const session = await getSession();
  await recordPageView("/subscriptions");

  if (!session) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 flex-1 w-full">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">關鍵字訂閱管理</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          用 Discord 帳號登入,管理你的關鍵字訂閱——符合的新文章會私訊通知到你的 Discord。
        </p>
        <a
          href="/api/auth/discord"
          className="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          用 Discord 登入
        </a>
      </main>
    );
  }

  const subscriptions = await fetchSubscriptions(session.userId);
  const articlesByKeyword = await Promise.all(
    subscriptions.map(async (sub) => ({ keyword: sub.keyword, articles: await fetchArticlesForKeyword(sub.keyword) }))
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 flex-1 w-full">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">關鍵字訂閱管理</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        符合的新文章會私訊通知到你的 Discord({session.username})
      </p>

      <form action={subscribeAction} className="flex gap-2 mb-8">
        <input
          type="text"
          name="keyword"
          placeholder="新增關鍵字,例如 iphone 17"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          訂閱
        </button>
      </form>

      {subscriptions.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">還沒有訂閱任何關鍵字。</p>
      ) : (
        <div className="flex flex-col gap-6">
          {articlesByKeyword.map(({ keyword, articles }) => (
            <section
              key={keyword}
              className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {keyword}
                  </span>
                  <span className="truncate text-xs text-gray-400">
                    {articles.length > 0 ? `符合 ${articles.length} 篇` : "還沒抓到符合的文章"}
                  </span>
                </div>
                <form action={unsubscribeAction} className="shrink-0">
                  <input type="hidden" name="keyword" value={keyword} />
                  <button type="submit" className="text-xs text-red-600 hover:underline">
                    取消訂閱
                  </button>
                </form>
              </div>

              {articles.length > 0 && (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {articles.map((article) => (
                    <li key={article.articleId} className="px-4 py-3">
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-gray-900 hover:text-blue-700 dark:text-gray-100 dark:hover:text-blue-400"
                      >
                        {article.title}
                      </a>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {article.author} · {article.postTime || article.postDate}
                        {article.pushCount ? ` · 推 ${article.pushCount}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
