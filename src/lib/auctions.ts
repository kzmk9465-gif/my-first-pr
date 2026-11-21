import { getDb, nowIso, transaction } from "./db.ts";
import { siteConfig } from "./config.ts";
import { notifyUser } from "./notify.ts";
import { yen } from "./format.ts";
import { createOrder } from "./sellers.ts";
import { createHash } from "node:crypto";

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
  status: "scheduled" | "open" | "ended" | "cancelled" | "review";
  winner_id: number | null;
  buyout_price: number | null;
  subtitle: string | null;
  images: string | null;
  video_url: string | null;
  shipping_method: "normal" | "cool";
  shipping_fee: number;
  fee_rate: number;
  created_by: number | null;
  min_rank: number;
  passphrase_hash: string | null;
  mystery: number;
  featured: number;
  hot: number;
  extended_count: number;
  sudden_death: number;
  bid_count: number;
  created_at: string;
};

export type Bid = { id: number; listing_id: number; user_id: number; amount: number; is_auto: number; created_at: string; bidder_label: string };

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
      const lead = tx
        .prepare("SELECT user_id FROM max_bids WHERE listing_id = ? ORDER BY max_amount DESC, created_at ASC LIMIT 1")
        .get(id) as { user_id: number } | undefined;
      const top = lead ? { user_id: lead.user_id, amount: l.current_price } : undefined;
      tx.prepare("UPDATE listings SET status = 'ended', winner_id = ? WHERE id = ?").run(top?.user_id ?? null, id);
      if (top) createOrder(l as unknown as Listing, top.user_id);
      return { listing: l, top };
    });
    if (result?.top) {
      const winner = getDb()
        .prepare("SELECT id, email, line_user_id FROM users WHERE id = ?")
        .get(result.top.user_id) as { id: number; email: string; line_user_id: string | null };
      await notifyUser(
        winner,
        "won",
        `「${result.listing.title}」を ${yen(result.top.amount)} で落札しました。マイページの「取引のいま」からお支払い手続きへお進みください（落札後${siteConfig.payment.dueDays}日以内）。`,
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
  q?: string;
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
  if (f.q && f.q.trim()) {
    const like = `%${f.q.trim().replace(/[%_]/g, "")}%`;
    where.push("(l.title LIKE ? OR l.variety LIKE ? OR l.breeder LIKE ? OR s.name LIKE ?)");
    params.push(like, like, like, like);
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
    db.prepare(`SELECT COUNT(*) AS c FROM listings l JOIN sellers s ON s.id = l.seller_id ${w}`).get(...params) as { c: number }
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

/** 延長秒数。サドンデスなら延長回数ごとに短くなる（5分→4分→…→最短1分）。 */
export function extensionSeconds(l: Pick<Listing, "sudden_death" | "extended_count">): number {
  const base = siteConfig.autoExtendSeconds;
  if (!l.sudden_death) return base;
  const step = Math.max(1, Math.floor(base / 5));
  return Math.max(siteConfig.minExtendSeconds, base - step * l.extended_count);
}

export type BidResult =
  | { ok: true; outcome: "leading" | "raised" | "lost"; price: number; max: number; extended: boolean }
  | { ok: false; error: string };

type MaxBid = { user_id: number; max_amount: number; created_at: string };

/**
 * 上限額方式の入札（見えざる戦い）。
 * amount は「ここまでなら出せる」上限で、実際の価格は競合状況で決まる。
 * - 入札が無ければ開始価格でトップになる
 * - 既にトップなら上限だけ更新（価格は動かない）
 * - 現トップの上限を超えれば、相手の上限＋入札単位（自分の上限が上限）でトップになる
 * - 超えなければ即負け。価格は自分の上限（相手の上限が上限）まで上がり、競り負け履歴に残る
 */
export async function placeBid(listingId: number, userId: number, amount: number): Promise<BidResult> {
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: "金額は整数で入力してください。" };

  let notifyOutbid: number | undefined;
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
    title = l.title;

    const leader = tx
      .prepare("SELECT user_id, max_amount, created_at FROM max_bids WHERE listing_id = ? ORDER BY max_amount DESC, created_at ASC LIMIT 1")
      .get(listingId) as MaxBid | undefined;
    const mine = tx
      .prepare("SELECT user_id, max_amount, created_at FROM max_bids WHERE listing_id = ? AND user_id = ?")
      .get(listingId, userId) as MaxBid | undefined;

    const upsertMax = (max: number) =>
      tx
        .prepare(
          `INSERT INTO max_bids (listing_id, user_id, max_amount) VALUES (?, ?, ?)
           ON CONFLICT(listing_id, user_id) DO UPDATE SET max_amount = excluded.max_amount, updated_at = ?`,
        )
        .run(listingId, userId, max, now);
    const insertBid = (uid: number, price: number, auto: boolean) =>
      tx.prepare("INSERT INTO bids (listing_id, user_id, amount, is_auto) VALUES (?, ?, ?, ?)").run(listingId, uid, price, auto ? 1 : 0);

    let outcome: "leading" | "raised" | "lost";
    let price = l.current_price;

    if (!leader) {
      // 最初の入札
      if (amount < l.start_price) return { ok: false, error: `${yen(l.start_price)} 以上で入札してください。` };
      upsertMax(amount);
      price = l.start_price;
      insertBid(userId, price, false);
      outcome = "leading";
    } else if (leader.user_id === userId) {
      // 既にトップ：上限の引き上げのみ
      if (amount <= (mine?.max_amount ?? 0)) return { ok: false, error: `現在の上限 ${yen(mine!.max_amount)} より高い金額を入力してください。` };
      upsertMax(amount);
      outcome = "raised";
    } else {
      const min = l.current_price + l.bid_increment;
      if (amount < min) return { ok: false, error: `${yen(min)} 以上で入札してください。` };
      if (amount > leader.max_amount) {
        // 相手の上限を超えた：相手の上限＋単位（自分の上限まで）でトップに
        price = Math.min(amount, leader.max_amount + l.bid_increment);
        upsertMax(amount);
        insertBid(userId, price, false);
        notifyOutbid = leader.user_id;
        outcome = "leading";
      } else {
        // 届かなかった：価格は自分の上限まで上がり（相手の上限が上限）、相手の自動入札として記録
        price = Math.min(leader.max_amount, amount === leader.max_amount ? amount : amount + l.bid_increment);
        if (price < l.current_price) price = l.current_price;
        upsertMax(amount);
        tx.prepare("INSERT INTO lost_bids (listing_id, user_id, amount, price_after) VALUES (?, ?, ?, ?)").run(listingId, userId, amount, price);
        if (price > l.current_price) insertBid(leader.user_id, price, true);
        outcome = "lost";
      }
    }

    // 自動延長（終了間際の入札はすべて対象。サドンデスなら延長幅が縮む）
    const remainingMs = new Date(l.ends_at).getTime() - Date.now();
    const extend = remainingMs < siteConfig.autoExtendWindowSeconds * 1000;
    let newEnd = l.ends_at;
    if (extend) {
      const candidate = new Date(Date.now() + extensionSeconds(l) * 1000).toISOString();
      if (candidate > l.ends_at) newEnd = candidate;
    }
    tx.prepare(
      "UPDATE listings SET current_price = ?, ends_at = ?, status = 'open', extended_count = extended_count + ? WHERE id = ?",
    ).run(price, newEnd, extend && newEnd !== l.ends_at ? 1 : 0, listingId);
    return { ok: true, outcome, price, max: amount, extended: extend && newEnd !== l.ends_at };
  });

  if (result.ok && notifyOutbid !== undefined) {
    const u = getDb()
      .prepare("SELECT id, email, line_user_id FROM users WHERE id = ?")
      .get(notifyOutbid) as { id: number; email: string; line_user_id: string | null };
    await notifyUser(u, "outbid", `「${title}」で高値更新されました。現在価格 ${yen(result.price)}`, listingId);
  }
  return result;
}

/* ---------- 第3段階：限定オークション（合言葉）・千両箱 ---------- */

export function hashPassphrase(p: string): string {
  const salt = process.env.OTP_SALT ?? "banshu-dev-salt";
  return createHash("sha256").update(`${salt}:pass:${p.trim()}`).digest("hex");
}

export function isUnlocked(userId: number, listingId: number): boolean {
  return !!getDb().prepare("SELECT 1 FROM listing_unlocks WHERE user_id = ? AND listing_id = ?").get(userId, listingId);
}

/** 合言葉を照合して解錠。 */
export function unlockListing(userId: number, listingId: number, passphrase: string): boolean {
  const l = getDb().prepare("SELECT passphrase_hash FROM listings WHERE id = ?").get(listingId) as { passphrase_hash: string | null } | undefined;
  if (!l) return false;
  if (!l.passphrase_hash) return true;
  if (l.passphrase_hash !== hashPassphrase(passphrase)) return false;
  getDb().prepare("INSERT OR IGNORE INTO listing_unlocks (user_id, listing_id) VALUES (?, ?)").run(userId, listingId);
  return true;
}

/** 千両箱の中身を見られる人か（落札者・出品者本人・管理者） */
export function canRevealMystery(l: Pick<Listing, "mystery" | "winner_id" | "seller_id" | "status">, user: { id: number; role: string } | null, mySellerId: number | null): boolean {
  if (!l.mystery) return true;
  if (!user) return false;
  if (user.role === "admin") return true;
  if (mySellerId === l.seller_id) return true;
  return l.status === "ended" && l.winner_id === user.id;
}

/** 現在のトップ入札者と自分の上限 */
export function bidStatus(listingId: number, userId?: number): { leader_id: number | null; my_max: number | null } {
  const db = getDb();
  const leader = db
    .prepare("SELECT user_id FROM max_bids WHERE listing_id = ? ORDER BY max_amount DESC, created_at ASC LIMIT 1")
    .get(listingId) as { user_id: number } | undefined;
  const mine = userId
    ? (db.prepare("SELECT max_amount FROM max_bids WHERE listing_id = ? AND user_id = ?").get(listingId, userId) as { max_amount: number } | undefined)
    : undefined;
  return { leader_id: leader?.user_id ?? null, my_max: mine?.max_amount ?? null };
}

export function myLostBids(userId: number, limit = 30) {
  return getDb()
    .prepare(
      `SELECT lb.*, l.title, l.status, l.current_price, l.ends_at, l.seller_id, s.name AS seller_name
       FROM lost_bids lb JOIN listings l ON l.id = lb.listing_id JOIN sellers s ON s.id = l.seller_id
       WHERE lb.user_id = ? ORDER BY lb.id DESC LIMIT ?`,
    )
    .all(userId, limit) as { id: number; listing_id: number; amount: number; price_after: number; created_at: string; title: string; status: string; current_price: number; ends_at: string; seller_name: string }[];
}

/* ---------- お気に入り ---------- */

export function isFavorite(userId: number, listingId: number): boolean {
  return !!getDb().prepare("SELECT 1 FROM favorites WHERE user_id = ? AND listing_id = ?").get(userId, listingId);
}

export function toggleFavorite(userId: number, listingId: number): boolean {
  const db = getDb();
  if (isFavorite(userId, listingId)) {
    db.prepare("DELETE FROM favorites WHERE user_id = ? AND listing_id = ?").run(userId, listingId);
    return false;
  }
  db.prepare("INSERT INTO favorites (user_id, listing_id) VALUES (?, ?)").run(userId, listingId);
  return true;
}

export function myFavorites(userId: number): Listing[] {
  return getDb()
    .prepare(`${LISTING_SELECT} JOIN favorites f ON f.listing_id = l.id AND f.user_id = ? ORDER BY l.status = 'open' DESC, l.ends_at ASC`)
    .all(userId) as Listing[];
}

export function favoriteIds(userId: number): Set<number> {
  return new Set((getDb().prepare("SELECT listing_id FROM favorites WHERE user_id = ?").all(userId) as { listing_id: number }[]).map((r) => r.listing_id));
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

export function myBids(userId: number): (Listing & { my_max: number; leader_id: number })[] {
  const sql = listingSelect(
    ", mb.max_amount AS my_max, (SELECT user_id FROM max_bids m2 WHERE m2.listing_id = l.id ORDER BY m2.max_amount DESC, m2.created_at ASC LIMIT 1) AS leader_id",
  );
  return getDb()
    .prepare(`${sql} JOIN max_bids mb ON mb.listing_id = l.id AND mb.user_id = ? ORDER BY l.ends_at DESC`)
    .all(userId) as (Listing & { my_max: number; leader_id: number })[];
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
  sudden_death?: boolean;
  buyout_price?: number | null;
  subtitle?: string;
  images?: string[];
  video_url?: string;
  shipping_method?: "normal" | "cool";
  shipping_fee?: number;
  fee_rate?: number;
  created_by?: number;
  /** true なら管理者の確認待ち（公開されない） */
  needs_review?: boolean;
  /** 闇市：このランク以上のみ入札可 */
  min_rank?: number;
  /** 限定オークション：合言葉 */
  passphrase?: string;
  /** 千両箱：画像をシルエット表示 */
  mystery?: boolean;
};

export async function createListing(input: ListingInput): Promise<number> {
  const status = input.needs_review ? "review" : input.starts_at > nowIso() ? "scheduled" : "open";
  const r = getDb()
    .prepare(
      `INSERT INTO listings (seller_id, title, variety, breeder, certificate, quantity, description, image_url,
         start_price, current_price, bid_increment, starts_at, ends_at, status, featured, hot, sudden_death,
         buyout_price, subtitle, images, video_url, shipping_method, shipping_fee, fee_rate, created_by, min_rank, passphrase_hash, mystery)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      (input.sudden_death ?? siteConfig.suddenDeathDefault) ? 1 : 0,
      input.buyout_price && input.buyout_price > input.start_price ? input.buyout_price : null,
      input.subtitle || null,
      input.images && input.images.length ? JSON.stringify(input.images) : null,
      input.video_url || null,
      input.shipping_method ?? "normal",
      input.shipping_fee ?? 0,
      input.fee_rate ?? 0,
      input.created_by ?? null,
      input.min_rank ?? 0,
      input.passphrase ? hashPassphrase(input.passphrase) : null,
      input.mystery ? 1 : 0,
    );
  const id = Number(r.lastInsertRowid);
  if (status === "review") return id;

  await notifyFollowersOfNewListing(id, input.seller_id, input.title);
  return id;
}

async function notifyFollowersOfNewListing(id: number, sellerId: number, title: string): Promise<void> {
  const input = { seller_id: sellerId, title };
  // フォロワーへ新規出品通知
  const followers = getDb()
    .prepare("SELECT u.id, u.email, u.line_user_id FROM follows f JOIN users u ON u.id = f.user_id WHERE f.seller_id = ?")
    .all(input.seller_id) as { id: number; email: string; line_user_id: string | null }[];
  const seller = getDb().prepare("SELECT name FROM sellers WHERE id = ?").get(input.seller_id) as { name: string };
  for (const f of followers) {
    await notifyUser(f, "new_listing", `フォロー中の ${seller.name} が「${input.title}」を出品しました。`, id);
  }
}

/** 管理者が確認待ちの出品を公開する */
export async function publishListing(id: number): Promise<boolean> {
  const db = getDb();
  const l = db.prepare("SELECT * FROM listings WHERE id = ? AND status = 'review'").get(id) as Listing | undefined;
  if (!l) return false;
  const now = nowIso();
  // 終了日時が過ぎていたら、今から3日後に設定し直す
  const ends = l.ends_at > now ? l.ends_at : new Date(Date.now() + 3 * 86_400_000).toISOString();
  const starts = l.starts_at > now ? l.starts_at : now;
  db.prepare("UPDATE listings SET status = ?, starts_at = ?, ends_at = ? WHERE id = ?").run(starts > now ? "scheduled" : "open", starts, ends, id);
  await notifyFollowersOfNewListing(id, l.seller_id, l.title);
  if (l.created_by) {
    const u = db.prepare("SELECT id, email, line_user_id FROM users WHERE id = ?").get(l.created_by) as { id: number; email: string; line_user_id: string | null };
    await notifyUser(u, "system", `出品「${l.title}」が公開されました。`, id);
  }
  return true;
}

export function reviewListings(): Listing[] {
  return getDb().prepare(`${LISTING_SELECT} WHERE l.status = 'review' ORDER BY l.created_at ASC`).all() as Listing[];
}

export function listingsForSeller(sellerId: number): Listing[] {
  return getDb()
    .prepare(`${LISTING_SELECT} WHERE l.seller_id = ? ORDER BY CASE l.status WHEN 'review' THEN 0 WHEN 'open' THEN 1 WHEN 'scheduled' THEN 2 ELSE 3 END, l.ends_at DESC`)
    .all(sellerId) as Listing[];
}

export function listingImages(l: Pick<Listing, "images" | "image_url">): string[] {
  const arr: string[] = [];
  if (l.images) {
    try { arr.push(...(JSON.parse(l.images) as string[])); } catch { /* ignore */ }
  }
  if (l.image_url && !arr.includes(l.image_url)) arr.unshift(l.image_url);
  return arr;
}

/** 即決。現在価格が即決価格未満の開催中オークションを、即決価格で落札して終了する。 */
export async function buyNow(listingId: number, userId: number): Promise<{ ok: true; price: number } | { ok: false; error: string }> {
  let title = "";
  const r = transaction((tx): { ok: true; price: number } | { ok: false; error: string } => {
    const l = tx.prepare("SELECT * FROM listings WHERE id = ?").get(listingId) as Listing | undefined;
    if (!l) return { ok: false, error: "出品が見つかりません。" };
    const now = nowIso();
    if (l.status === "scheduled" && l.starts_at <= now) l.status = "open";
    if (l.status !== "open" || l.ends_at <= now) return { ok: false, error: "このオークションは即決できません。" };
    if (!l.buyout_price) return { ok: false, error: "この出品に即決価格はありません。" };
    if (l.current_price >= l.buyout_price) return { ok: false, error: "現在価格が即決価格に達しているため即決できません。" };
    title = l.title;
    tx.prepare("INSERT INTO bids (listing_id, user_id, amount, is_auto) VALUES (?, ?, ?, 0)").run(listingId, userId, l.buyout_price);
    tx.prepare(
      `INSERT INTO max_bids (listing_id, user_id, max_amount) VALUES (?, ?, ?)
       ON CONFLICT(listing_id, user_id) DO UPDATE SET max_amount = excluded.max_amount, updated_at = ?`,
    ).run(listingId, userId, l.buyout_price, now);
    tx.prepare("UPDATE listings SET status = 'ended', winner_id = ?, current_price = ?, ends_at = ? WHERE id = ?").run(userId, l.buyout_price, now, listingId);
    createOrder({ ...l, current_price: l.buyout_price }, userId);
    return { ok: true, price: l.buyout_price };
  });
  if (r.ok) {
    const u = getDb().prepare("SELECT id, email, line_user_id FROM users WHERE id = ?").get(userId) as { id: number; email: string; line_user_id: string | null };
    await notifyUser(u, "won", `「${title}」を即決価格 ${yen(r.price)} で落札しました。マイページの「取引のいま」からお支払い手続きへお進みください。`, listingId);
  }
  return r;
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
