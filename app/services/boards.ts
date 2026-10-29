// 爬蟲（scripts/mac-scraper-daemon.ts）也 import 這個檔，所以不能 import 其他東西
export const BOARDS = ["MacShop", "HardwareSale"] as const;

export type Board = (typeof BOARDS)[number];

export const DEFAULT_BOARD: Board = "MacShop";

export function parseBoard(value: unknown): Board {
  return BOARDS.find((b) => b === value) ?? DEFAULT_BOARD;
}
