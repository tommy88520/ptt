export const CATEGORIES = ["", "販售", "徵求"] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = { "": "不限", 販售: "販售", 徵求: "徵求" };

// 實際標題變化很多（[販售/交換]、[賣/苗栗]、[徵/新北]），所以看分類標籤的第一個字
export const CATEGORY_TITLE_PATTERNS: Record<Exclude<Category, "">, string> = {
  販售: "^\\s*\\[(販|賣)",
  徵求: "^\\s*\\[徵",
};

export function parseCategory(value: unknown): Category {
  return CATEGORIES.find((c) => c === value) ?? "";
}

export function titleMatchesCategory(title: string, category: Category): boolean {
  return category === "" || new RegExp(CATEGORY_TITLE_PATTERNS[category]).test(title);
}
