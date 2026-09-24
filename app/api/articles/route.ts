import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { insertArticle, listArticles, type NewArticle } from "@/app/services/articles";
import { notifySubscribers } from "@/app/services/notifications";

const DEFAULT_BOARD = "MacShop";
const REQUIRED_FIELDS = ["articleId", "board", "title", "author", "url"] as const;
const OPTIONAL_FIELDS = ["postDate", "postTime", "pushCount", "content"] as const;

function hasValidApiKey(request: NextRequest): boolean {
  const expected = process.env.PTT_API_KEY;
  const given = request.headers.get("x-api-key");
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const board = params.get("board") || DEFAULT_BOARD;
  const keyword = params.get("keyword")?.trim() || undefined;
  const limit = Math.min(Number(params.get("limit")) || 20, 100);

  const items = await listArticles({ board, keyword, limit });
  return NextResponse.json({ board, keyword: keyword ?? null, count: items.length, items });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!hasValidApiKey(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const missing = REQUIRED_FIELDS.filter((field) => typeof payload[field] !== "string" || !payload[field]);
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
  }

  const article = Object.fromEntries(
    [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => [field, typeof payload[field] === "string" ? payload[field] : ""])
  ) as unknown as NewArticle;

  const saved = await insertArticle(article);
  if (!saved) {
    return NextResponse.json({ saved: false, reason: "already exists", articleId: article.articleId });
  }

  await notifySubscribers(article);
  return NextResponse.json({ saved: true, articleId: article.articleId }, { status: 201 });
}
