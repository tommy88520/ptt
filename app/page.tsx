interface Article {
  articleId: string;
  board: string;
  title: string;
  author: string;
  postDate: string;
  postTime: string;
  pushCount: string;
  url: string;
  content: string;
}

async function fetchArticles(keyword: string | undefined, board: string): Promise<Article[]> {
  const url = new URL(`${process.env.PTT_API_BASE_URL}/articles`);
  url.searchParams.set("board", board);
  if (keyword) url.searchParams.set("keyword", keyword);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch articles: ${res.status}`);
  }
  const data = (await res.json()) as { items: Article[] };
  return data.items;
}

function parseTag(title: string): { tag: string | null; rest: string } {
  const match = title.match(/^\[(.+?)\]\s*(.*)$/);
  if (!match) return { tag: null, rest: title };
  return { tag: match[1], rest: match[2] };
}

const TAG_STYLES: Record<string, string> = {
  販售: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  徵求: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};
const DEFAULT_TAG_STYLE = "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ keyword?: string; board?: string }>;
}) {
  const params = await searchParams;
  const board = params.board || "MacShop";
  const keyword = params.keyword?.trim();
  const articles = await fetchArticles(keyword, board);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 flex-1 w-full">
      <h1 className="text-2xl font-semibold tracking-tight">PTT {board} 搜尋</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">每 5 分鐘自動更新一次</p>

      <form className="flex gap-2 mb-8">
        <input
          type="text"
          name="keyword"
          defaultValue={keyword}
          placeholder="搜尋標題關鍵字,例如 iphone 17"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          搜尋
        </button>
      </form>

      {articles.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">沒有符合的文章</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {articles.map((article) => {
            const { tag, rest } = parseTag(article.title);
            return (
              <li
                key={article.articleId}
                className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <a href={article.url} target="_blank" rel="noreferrer" className="group block">
                  <div className="flex items-start gap-2">
                    {tag && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TAG_STYLES[tag] ?? DEFAULT_TAG_STYLE}`}
                      >
                        {tag}
                      </span>
                    )}
                    <span className="font-medium text-gray-900 group-hover:text-blue-700 dark:text-gray-100 dark:group-hover:text-blue-400">
                      {rest}
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {article.author} · {article.postTime || article.postDate}
                    {article.pushCount ? ` · 推 ${article.pushCount}` : ""}
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
