import { getDb } from "./db.ts";
import { siteConfig } from "./config.ts";

export type Rank = { level: number; min: number; name: string };

/** 累計落札額からランクを求める */
export function rankFor(total: number): Rank {
  let r = siteConfig.ranks[0] ?? { level: 0, min: 0, name: "会員" };
  for (const x of siteConfig.ranks) if (total >= x.min) r = x;
  return r;
}

export function rankByLevel(level: number): Rank {
  return siteConfig.ranks.find((r) => r.level === level) ?? siteConfig.ranks[0];
}

/** 会員の累計落札額（入金確認済み以降の取引の合計）とランク、次のランクまでの額 */
export function userRank(userId: number): { total: number; rank: Rank; next: Rank | null; toNext: number } {
  const row = getDb()
    .prepare("SELECT COALESCE(SUM(price), 0) AS total FROM orders WHERE buyer_id = ? AND status IN ('paid','shipped','completed')")
    .get(userId) as { total: number };
  const rank = rankFor(row.total);
  const next = siteConfig.ranks.find((r) => r.level === rank.level + 1) ?? null;
  return { total: row.total, rank, next, toNext: next ? next.min - row.total : 0 };
}
