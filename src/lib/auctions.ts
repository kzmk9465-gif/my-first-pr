import { getDb, nowIso, transaction } from "./db.ts";
import { siteConfig } from "./config.ts";
import { notifyUser } from "./notify.ts";
import { yen } from "./format.ts";

export type Seller = { id: number; name: string; slug: string; description: string | null };

export type Listing = {
  id: number;
  seller_id: number;
  seller_name: string;
  seller_slug: string;
  title: string;
  variety: string | null;
  breeder: string | null;
  certificate: "original" | "sales" | "bloodline" | null;
  quantity: string | null;
  description: string | null;
  image_url: string | null;
  start_price: number;
  current_price: number;
  bid_increment: number;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "open" | "ended" | "cancelled";
  winner_id: number | null;
  featured: number;
  hot: number;
  extended_count: number;
  bid_count: number;
  created_at: string;
};

export type Bid = { id: number; listing_id: number; user_id: number; amount: number; created_at: string; bidder_label: string };

/** 出品の共通SELECT。extra に追加列（先頭カンマ付き）を渡せる。 */
function listingSelect(extra = ""): string {
  return `
  SELECT l.*, s.name AS seller_name, s.slug AS seller_slug,
         (SELECT COUNT(*) FROM bids b WHERE b.listing_id = l.id) AS bid_count${extra}
  FROM listings l JOIN sellers s ON s.id = l.seller_id`;
}
const LISTING_SELECT = listingSelect();

/** 終了時刻を過ぎた開催中オークションを確定する（読み取り時に遅延実行） */
export async function finalizeEnded(): Promise<number> {
  const db = getDb();
  const now = nowIso();
  // 予約中 → 開催中
  db.prepare("UPDATE listings SET status = 'open' WHERE status = 'scheduled' AND starts_at <= ?").run(now);

  const ended = db
    .prepare("SELECT id FROM listings WHERE status = 'open' AND ends_at <= ?")
    .all(now) as { id: number }[];
  for (const { id } of ended) {
    const result = transaction((tx) => {
      const l = tx.prepare("SELECT * FROM listings WHERE id = ? AND status = 'open'").get(id) as
        | { id: number; title: string; current_price: number; ends_at: string }
        | undefined;
      if (!l || l.ends_at > nowIso()) return null;
      const top = tx
        .prepare("SELECT user_id, amount FROM bids WHERE listing_id = ? ORDER BY amount DESC, id ASC LIMIT 1")
        .get(id) as { user_id: number; amount: number } | undefined;
      tx.prepare("UPDATE listings SET status = 'ended', winner_id = ? WHERE id = ?").run(top?.user_id ?? null, id);
      return { listing: l, top };
    });
    if (result?.top) {
      const winner = getDb()
        .prepare("SELECT id, email, line_user_id FROM users WHERE id = ?")
        .get(result.top.user_id) as { id: number; email: string; line_user_id: string | null };
      await notifyUser(
        winner,
        "won",
        `「${result.listing.title}」を ${yen(result.top.amount)} で落札しました。マイページから発送先をご確認ください。お支払いは${siteConfig.payment.method}（落札後${siteConfig.payment.dueDays}日以内）です。`,
        id,
      );
    }
  }
  return ended.length;
}

export type ListFilter = {
  tab: "open" | "ended";
  endWithin?: "today" | "tomorrow" | "3days";
  sort?: "ending" | "price_desc" | "price_asc" | "newest";
  sellerId?: number;
  limit?: number;
  offset?: number;
};

export function listListings(f: ListFilter): { items: Listing[]; total: number } {
  const db = getDb();
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (f.tab === "open") where.push("l.status IN ('open','scheduled')");
  else where.push("l.status IN ('ended','cancelled')");
  if (f.sellerId) {
    where.push("l.seller_id = ?");
    params.push(f.sellerId);
  }
  if (f.tab === "open" && f.endWithin) {
    const jstNow = new Date(Date.now() + 9 * 3600_000);
    const dayStart = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - 9 * 3600_000;
    const days = f.endWithin === "today" ? 1 : f.endWithin === "tomorrow" ? 2 : 3;
    where.push("l.ends_at < ?");
    params.push(new Date(dayStart + days * 86_400_000).toISOString());
  }
  const order =
    f.sort === "price_desc"
      ? "l.current_price DESC, l.ends_at ASC"
      : f.sort === "price_asc"
        ? "l.current_price ASC, l.ends_at ASC"
        : f.sort === "newest"
          ? "l.created_at DESC"
          : f.tab === "ended"
            ? "l.ends_at DESC"
            : "l.featured DESC, l.ends_at ASC";
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM listings l ${w}`).get(...params) as { c: number }
  ).c;
  const limit = f.limit ?? 30;
  const offset = f.offset ?? 0;
  const items = db
    .prepare(`${LISTING_SELECT} ${w} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Listing[];
  return { items, total };
}

export function getListing(id: number): Listing | null {
  const row = getDb().prepare(`${LISTING_SELECT} WHERE l.id = ?`).get(id) as Listing | undefined;
  return row ?? null;
}

export function getBids(listingId: number): Bid[] {
  return getDb()
    .prepare(
      `SELECT b.*, COALESCE(u.name, '会員' || b.user_id) AS bidder_label
       FROM bids b JOIN users u ON u.id = b.user_id
       WHERE b.listing_id = ? ORDER BY b.amount DESC, b.id ASC`,
    )
    .all(listingId) as Bid[];
}

export function minimumBid(l: Pick<Listing, "current_price" | "start_price" | "bid_increment" | "bid_count">): number {
  return l.bid_count === 0 ? l.start_price : l.current_price + l.bid_increment;
}

export type BidResult =
  | { ok: true; amount: number; extended: boolean }
  | { ok: false; error: string };

/** 入札。排他トランザクションで価格更新と自動延長を行う。 */
export async function placeBid(listingId: number, userId: number, amount: number): Promise<BidResult> {
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: "金額は整数で入力してください。" };

  let outbid: { user_id: number } | undefined;
  let title = "";
  const result = transaction((tx): BidResult => {
    const l = tx
      .prepare(
        `SELECT l.*, (SELECT COUNT(*) FROM bids b WHERE b.listing_id = l.id) AS bid_count
         FROM listings l WHERE l.id = ?`,
      )
      .get(listingId) as Listing | undefined;
    if (!l) return { ok: false, error: "出品が見つかりません。" };
    const now = nowIso();
    if (l.status === "scheduled" && l.starts_at <= now) l.status = "open";
    if (l.status !== "open") return { ok: false, error: "このオークションは入札を受け付けていません。" };
    if (l.ends_at <= now) return { ok: false, error: "このオークションは終了しました。" };
    const min = minimumBid(l);
    if (amount < min) return { ok: false, error: `${yen(min)} 以上で入札してください。` };
    if (amount % l.bid_increment !== 0 && amount !== l.start_price) {
      return { ok: false, error: `入札単位は ${yen(l.bid_increment)} です。` };
    }
    title = l.title;
    outbid = tx
      .prepare("SELECT user_id FROM bids WHERE listing_id = ? ORDER BY amount DESC, id ASC LIMIT 1")
      .get(listingId) as { user_id: number } | undefined;
    if (outbid?.user_id === userId) outbid = undefined;

    tx.prepare("INSERT INTO bids (listing_id, user_id, amount) VALUES (?, ?, ?)").run(listingId, userId, amount);

    const remainingMs = new Date(l.ends_at).getTime() - Date.now();
    const extend = remainingMs < siteConfig.autoExtendWindowSeconds * 1000;
    const newEnd = extend
      ? new Date(Date.now() + siteConfig.autoExtendSeconds * 1000).toISOString()
      : l.ends_at;
    tx.prepare(
      "UPDATE listings SET current_price = ?, ends_at = ?, status = 'open', extended_count = extended_count + ? WHERE id = ?",
    ).run(amount, newEnd, extend ? 1 : 0, listingId);
    return { ok: true, amount, extended: extend };
  });

  if (result.ok && outbid) {
    const u = getDb()
      .prepare("SELECT id, email, line_user_id FROM users WHERE id = ?")
      .get(outbid.user_id) as { id: number; email: string; line_user_id: string | null };
    await notifyUser(u, "outbid", `「${title}」で高値更新されました。現在価格 ${yen(amount)}`, listingId);
  }
  return result;
}

/* ---------- 出品者・フォロー ---------- */

export function getSellers(): Seller[] {
  return getDb().prepare("SELECT * FROM sellers ORDER BY name").all() as Seller[];
}

export function getSellerBySlug(slug: string): Seller | null {
  return (getDb().prepare("SELECT * FROM sellers WHERE slug = ?").get(slug) as Seller | undefined) ?? null;
}

export function isFollowing(userId: number, sellerId: number): boolean {
  return !!getDb().prepare("SELECT 1 FROM follows WHERE user_id = ? AND seller_id = ?").get(userId, sellerId);
}

export function toggleFollow(userId: number, sellerId: number): boolean {
  const db = getDb();
  if (isFollowing(userId, sellerId)) {
    db.prepare("DELETE FROM follows WHERE user_id = ? AND seller_id = ?").run(userId, sellerId);
    return false;
  }
  db.prepare("INSERT INTO follows (user_id, seller_id) VALUES (?, ?)").run(userId, sellerId);
  return true;
}

export function followedSellers(userId: number): Seller[] {
  return getDb()
    .prepare("SELECT s.* FROM follows f JOIN sellers s ON s.id = f.seller_id WHERE f.user_id = ? ORDER BY s.name")
    .all(userId) as Seller[];
}

/* ---------- マイページ ---------- */

export function myBids(userId: number): (Listing & { my_max: number })[] {
  const sql = listingSelect(", (SELECT MAX(b2.amount) FROM bids b2 WHERE b2.listing_id = l.id AND b2.user_id = ?) AS my_max");
  return getDb()
    .prepare(`${sql} WHERE EXISTS (SELECT 1 FROM bids b3 WHERE b3.listing_id = l.id AND b3.user_id = ?) ORDER BY l.ends_at DESC`)
    .all(userId, userId) as (Listing & { my_max: number })[];
}

export function myWins(userId: number): Listing[] {
  return getDb()
    .prepare(`${LISTING_SELECT} WHERE l.winner_id = ? ORDER BY l.ends_at DESC`)
    .all(userId) as Listing[];
}

export function myNotifications(userId: number, limit = 20) {
  return getDb()
    .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ?")
    .all(userId, limit) as { id: number; type: string; message: string; listing_id: number | null; read: number; created_at: string }[];
}

export function markNotificationsRead(userId: number): void {
  getDb().prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(userId);
}

/* ---------- 管理 ---------- */

export type ListingInput = {
  seller_id: number;
  title: string;
  variety: string;
  breeder: string;
  certificate: string;
  quantity: string;
  description: string;
  image_url: string;
  start_price: number;
  bid_increment: number;
  starts_at: string;
  ends_at: string;
  featured: boolean;
  hot: boolean;
};

export async function createListing(input: ListingInput): Promise<number> {
  const status = input.starts_at > nowIso() ? "scheduled" : "open";
  const r = getDb()
    .prepare(
      `INSERT INTO listings (seller_id, title, variety, breeder, certificate, quantity, description, image_url,
         start_price, current_price, bid_increment, starts_at, ends_at, status, featured, hot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.seller_id,
      input.title,
      input.variety || null,
      input.breeder || null,
      input.certificate || null,
      input.quantity || null,
      input.description || null,
      input.image_url || null,
      input.start_price,
      input.start_price,
      input.bid_increment,
      input.starts_at,
      input.ends_at,
      status,
      input.featured ? 1 : 0,
      input.hot ? 1 : 0,
    );
  const id = Number(r.lastInsertRowid);

  // フォロワーへ新規出品通知
  const followers = getDb()
    .prepare("SELECT u.id, u.email, u.line_user_id FROM follows f JOIN users u ON u.id = f.user_id WHERE f.seller_id = ?")
    .all(input.seller_id) as { id: number; email: string; line_user_id: string | null }[];
  const seller = getDb().prepare("SELECT name FROM sellers WHERE id = ?").get(input.seller_id) as { name: string };
  for (const f of followers) {
    await notifyUser(f, "new_listing", `フォロー中の ${seller.name} が「${input.title}」を出品しました。`, id);
  }
  return id;
}

export function cancelListing(id: number): void {
  getDb().prepare("UPDATE listings SET status = 'cancelled' WHERE id = ? AND status IN ('open','scheduled')").run(id);
}

export function createSeller(name: string, slug: string, description: string): number {
  const r = getDb()
    .prepare("INSERT INTO sellers (name, slug, description) VALUES (?, ?, ?)")
    .run(name, slug, description || null);
  return Number(r.lastInsertRowid);
}

export function endedWithWinners(limit = 50) {
  return getDb()
    .prepare(
      `${LISTING_SELECT}
       LEFT JOIN users u ON u.id = l.winner_id
       WHERE l.status = 'ended' ORDER BY l.ends_at DESC LIMIT ?`,
    )
    .all(limit) as Listing[];
}

export function getUserById(id: number) {
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | { id: number; email: string; name: string | null; shipping_name: string | null; shipping_postal: string | null; shipping_address: string | null; shipping_phone: string | null }
    | undefined;
}
