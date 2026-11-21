import { getDb, nowIso } from "./db.ts";

export type News = {
  id: number;
  kind: "news" | "alert" | "broadcast";
  title: string;
  body: string | null;
  image_url: string | null;
  active: number;
  expires_at: string | null;
  created_at: string;
};

/** 有効なお知らせ。kind を指定すればその種類だけ。 */
export function activeNews(kind?: News["kind"], limit = 20): News[] {
  const now = nowIso();
  const where = ["active = 1", "(expires_at IS NULL OR expires_at > ?)"];
  const params: (string | number)[] = [now];
  if (kind) { where.push("kind = ?"); params.push(kind); }
  return getDb().prepare(`SELECT * FROM news WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ?`).all(...params, limit) as News[];
}

export function allNews(limit = 100): News[] {
  return getDb().prepare("SELECT * FROM news ORDER BY id DESC LIMIT ?").all(limit) as News[];
}

export function createNews(data: { kind: News["kind"]; title: string; body: string; image_url: string; expires_in_minutes?: number }): number {
  const expires = data.expires_in_minutes ? new Date(Date.now() + data.expires_in_minutes * 60_000).toISOString() : null;
  const r = getDb()
    .prepare("INSERT INTO news (kind, title, body, image_url, expires_at) VALUES (?, ?, ?, ?, ?)")
    .run(data.kind, data.title.trim().slice(0, 120), data.body.trim().slice(0, 2000) || null, data.image_url.trim().slice(0, 500) || null, expires);
  return Number(r.lastInsertRowid);
}

export function setNewsActive(id: number, active: boolean): void {
  getDb().prepare("UPDATE news SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
}

/** 瓦版の自動記事：直近に終了した激戦の品（入札数順） */
export function hotResults(limit = 5) {
  return getDb()
    .prepare(
      `SELECT l.id, l.title, l.current_price, l.ends_at, s.name AS seller_name,
              (SELECT COUNT(*) FROM bids b WHERE b.listing_id = l.id) AS bid_count,
              (SELECT COUNT(DISTINCT user_id) FROM bids b WHERE b.listing_id = l.id) AS bidders
       FROM listings l JOIN sellers s ON s.id = l.seller_id
       WHERE l.status = 'ended' AND l.winner_id IS NOT NULL AND l.ends_at >= ?
       ORDER BY bid_count DESC, l.current_price DESC LIMIT ?`,
    )
    .all(new Date(Date.now() - 14 * 86_400_000).toISOString(), limit) as { id: number; title: string; current_price: number; ends_at: string; seller_name: string; bid_count: number; bidders: number }[];
}

/** 瓦版風の見出し文を作る（見るたびに違う言い回し） */
export function headline(r: { title: string; current_price: number; bid_count: number; bidders: number; seller_name: string }, seed = Date.now()): string {
  const t = [
    `【号外】${r.title}、${r.bidders}名による${r.bid_count}度の攻防の末、${r.current_price.toLocaleString()}円にて落着！`,
    `${r.seller_name}出品の${r.title}に入札${r.bid_count}件。最後は${r.current_price.toLocaleString()}円で幕。`,
    `${r.title}をめぐり${r.bidders}名が激突。終値${r.current_price.toLocaleString()}円は見事な競り。`,
    `播州の会場が沸いた${r.title}。${r.bid_count}件の入札、${r.current_price.toLocaleString()}円で新たな主のもとへ。`,
  ];
  return t[Math.abs(Math.floor(seed / 60000)) % t.length];
}
