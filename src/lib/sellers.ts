import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getDb, nowIso } from "./db.ts";
import { siteConfig } from "./config.ts";
import { notifyUser } from "./notify.ts";
import { yen } from "./format.ts";

export type SellerAccount = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  user_id: number | null;
  pin_hash: string | null;
  fee_rate: number;
  shipping_normal: number;
  shipping_cool: number;
  payment_info: string | null;
  accepts_online: number;
};

export type Order = {
  listing_id: number;
  buyer_id: number;
  seller_id: number;
  status: "awaiting_payment" | "paid" | "shipped" | "completed" | "cancelled";
  paid_via: string | null;
  price: number;
  shipping_fee: number;
  shipping_method: string | null;
  fee_rate: number;
  carrier: string | null;
  tracking_no: string | null;
  note: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

const MAX_TEMPLATES = 10;

/* ---------- 出品者アカウント ---------- */

export function getSellerForUser(userId: number): SellerAccount | null {
  return (getDb().prepare("SELECT * FROM sellers WHERE user_id = ?").get(userId) as SellerAccount | undefined) ?? null;
}

export function getSellerById(id: number): SellerAccount | null {
  return (getDb().prepare("SELECT * FROM sellers WHERE id = ?").get(id) as SellerAccount | undefined) ?? null;
}

function hashPin(pin: string): string {
  const salt = process.env.OTP_SALT ?? "banshu-dev-salt";
  return createHash("sha256").update(`${salt}:pin:${pin}`).digest("hex");
}

export function setSellerPin(sellerId: number, pin: string): void {
  getDb().prepare("UPDATE sellers SET pin_hash = ? WHERE id = ?").run(hashPin(pin), sellerId);
}

export function verifySellerPin(seller: SellerAccount, pin: string): boolean {
  if (!seller.pin_hash) return false;
  const a = Buffer.from(seller.pin_hash);
  const b = Buffer.from(hashPin(pin));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 管理者が出品者アカウントを設定（会員との紐づけ・手数料・PIN） */
export function updateSellerAccount(
  sellerId: number,
  data: { user_id: number | null; fee_rate: number; pin?: string; shipping_normal?: number; shipping_cool?: number; payment_info?: string; accepts_online?: boolean },
): void {
  const db = getDb();
  db.prepare("UPDATE sellers SET user_id = ?, fee_rate = ? WHERE id = ?").run(data.user_id, data.fee_rate, sellerId);
  if (data.accepts_online !== undefined) db.prepare("UPDATE sellers SET accepts_online = ? WHERE id = ?").run(data.accepts_online ? 1 : 0, sellerId);
  if (data.pin) setSellerPin(sellerId, data.pin);
  if (data.shipping_normal !== undefined) db.prepare("UPDATE sellers SET shipping_normal = ? WHERE id = ?").run(data.shipping_normal, sellerId);
  if (data.shipping_cool !== undefined) db.prepare("UPDATE sellers SET shipping_cool = ? WHERE id = ?").run(data.shipping_cool, sellerId);
  if (data.payment_info !== undefined) db.prepare("UPDATE sellers SET payment_info = ? WHERE id = ?").run(data.payment_info || null, sellerId);
}

/** 出品者自身が変更できる設定（送料・支払い案内・紹介文） */
export function updateSellerSettings(
  sellerId: number,
  data: { shipping_normal: number; shipping_cool: number; payment_info: string; description: string; accepts_online: boolean },
): void {
  getDb()
    .prepare("UPDATE sellers SET shipping_normal = ?, shipping_cool = ?, payment_info = ?, description = ?, accepts_online = ? WHERE id = ?")
    .run(data.shipping_normal, data.shipping_cool, data.payment_info || null, data.description || null, data.accepts_online ? 1 : 0, sellerId);
}

/* ---------- 説明文テンプレート ---------- */

export function listTemplates(sellerId: number) {
  return getDb().prepare("SELECT * FROM listing_templates WHERE seller_id = ? ORDER BY id DESC").all(sellerId) as { id: number; name: string; body: string }[];
}

export function saveTemplate(sellerId: number, name: string, body: string): { ok: true; id: number } | { ok: false; error: string } {
  const db = getDb();
  const count = (db.prepare("SELECT COUNT(*) AS c FROM listing_templates WHERE seller_id = ?").get(sellerId) as { c: number }).c;
  if (count >= MAX_TEMPLATES) return { ok: false, error: `テンプレートは${MAX_TEMPLATES}件までです。不要なものを削除してください。` };
  const r = db.prepare("INSERT INTO listing_templates (seller_id, name, body) VALUES (?, ?, ?)").run(sellerId, name, body);
  return { ok: true, id: Number(r.lastInsertRowid) };
}

export function deleteTemplate(sellerId: number, id: number): void {
  getDb().prepare("DELETE FROM listing_templates WHERE id = ? AND seller_id = ?").run(id, sellerId);
}

/* ---------- 取引（落札後） ---------- */

export function getOrder(listingId: number): Order | null {
  return (getDb().prepare("SELECT * FROM orders WHERE listing_id = ?").get(listingId) as Order | undefined) ?? null;
}

/** 落札確定時に取引を作成（既にあれば何もしない） */
export function createOrder(listing: { id: number; seller_id: number; current_price: number; shipping_fee: number; shipping_method: string; fee_rate: number }, buyerId: number): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO orders (listing_id, buyer_id, seller_id, status, price, shipping_fee, shipping_method, fee_rate)
       VALUES (?, ?, ?, 'awaiting_payment', ?, ?, ?, ?)`,
    )
    .run(listing.id, buyerId, listing.seller_id, listing.current_price, listing.shipping_fee, listing.shipping_method, listing.fee_rate);
}

export type OrderWithListing = Order & {
  title: string;
  image_url: string | null;
  seller_name: string;
  seller_payment_info: string | null;
  seller_accepts_online: number;
  buyer_email: string;
  buyer_name: string | null;
  buyer_line: string | null;
  shipping_name: string | null;
  shipping_postal: string | null;
  shipping_address: string | null;
  shipping_phone: string | null;
};

const ORDER_SELECT = `
  SELECT o.*, l.title, l.image_url, s.name AS seller_name, s.payment_info AS seller_payment_info, s.accepts_online AS seller_accepts_online,
         u.email AS buyer_email, u.name AS buyer_name, u.line_user_id AS buyer_line,
         u.shipping_name, u.shipping_postal, u.shipping_address, u.shipping_phone
  FROM orders o JOIN listings l ON l.id = o.listing_id JOIN sellers s ON s.id = o.seller_id JOIN users u ON u.id = o.buyer_id`;

export function ordersForBuyer(buyerId: number): OrderWithListing[] {
  return getDb().prepare(`${ORDER_SELECT} WHERE o.buyer_id = ? ORDER BY o.created_at DESC`).all(buyerId) as OrderWithListing[];
}

export function ordersForSeller(sellerId: number): OrderWithListing[] {
  return getDb()
    .prepare(`${ORDER_SELECT} WHERE o.seller_id = ? ORDER BY CASE o.status WHEN 'awaiting_payment' THEN 0 WHEN 'paid' THEN 1 WHEN 'shipped' THEN 2 ELSE 3 END, o.created_at DESC`)
    .all(sellerId) as OrderWithListing[];
}

const TRANSITIONS: Record<string, Order["status"][]> = {
  awaiting_payment: ["paid", "cancelled"],
  paid: ["shipped", "awaiting_payment"],
  shipped: ["completed", "paid"],
  completed: [],
  cancelled: ["awaiting_payment"],
};

/** 出品者が取引ステータスを進める。発送済みにすると落札者へ追跡番号付きで通知。 */
export async function updateOrderStatus(
  sellerId: number,
  listingId: number,
  status: Order["status"],
  extra: { carrier?: string; tracking_no?: string; note?: string } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  const o = getOrder(listingId);
  if (!o || o.seller_id !== sellerId) return { ok: false, error: "取引が見つかりません。" };
  if (!TRANSITIONS[o.status].includes(status)) return { ok: false, error: "その状態には変更できません。" };
  const now = nowIso();
  db.prepare(
    `UPDATE orders SET status = ?, carrier = COALESCE(?, carrier), tracking_no = COALESCE(?, tracking_no), note = COALESCE(?, note),
       paid_at = CASE WHEN ? = 'paid' THEN ? ELSE paid_at END,
       shipped_at = CASE WHEN ? = 'shipped' THEN ? ELSE shipped_at END,
       completed_at = CASE WHEN ? = 'completed' THEN ? ELSE completed_at END,
       updated_at = ? WHERE listing_id = ?`,
  ).run(status, extra.carrier ?? null, extra.tracking_no ?? null, extra.note ?? null, status, now, status, now, status, now, now, listingId);

  const buyer = db.prepare("SELECT id, email, line_user_id FROM users WHERE id = ?").get(o.buyer_id) as { id: number; email: string; line_user_id: string | null };
  const title = (db.prepare("SELECT title FROM listings WHERE id = ?").get(listingId) as { title: string }).title;
  if (status === "paid") await notifyUser(buyer, "system", `「${title}」のご入金を確認しました。発送までお待ちください。`, listingId);
  if (status === "shipped") {
    const track = [extra.carrier ?? o.carrier, extra.tracking_no ?? o.tracking_no].filter(Boolean).join(" ");
    await notifyUser(buyer, "system", `「${title}」を発送しました。${track ? `追跡：${track}` : ""}`, listingId);
  }
  return { ok: true };
}

/** 落札者が受け取り完了にする */
export function completeOrderByBuyer(buyerId: number, listingId: number): boolean {
  const r = getDb()
    .prepare("UPDATE orders SET status = 'completed', completed_at = ?, updated_at = ? WHERE listing_id = ? AND buyer_id = ? AND status = 'shipped'")
    .run(nowIso(), nowIso(), listingId, buyerId);
  return r.changes > 0;
}

/* ---------- 手数料計算 ---------- */

export function feeBreakdown(price: number, feeRate: number): { fee: number; payout: number } {
  const fee = Math.floor((price * feeRate) / 100);
  return { fee, payout: price - fee };
}

export function sellerSummary(sellerId: number): { sold_count: number; gross: number; fee: number; payout: number } {
  const rows = getDb()
    .prepare("SELECT price, fee_rate FROM orders WHERE seller_id = ? AND status <> 'cancelled'")
    .all(sellerId) as { price: number; fee_rate: number }[];
  let gross = 0, fee = 0;
  for (const r of rows) {
    gross += r.price;
    fee += feeBreakdown(r.price, r.fee_rate).fee;
  }
  return { sold_count: rows.length, gross, fee, payout: gross - fee };
}

/** 出品ページ用：送料の候補 */
export function shippingOptions(seller: SellerAccount): { key: "normal" | "cool"; label: string; fee: number }[] {
  return [
    { key: "normal", label: `常温便（${yen(seller.shipping_normal)}）`, fee: seller.shipping_normal },
    { key: "cool", label: `クール便（${yen(seller.shipping_cool)}）`, fee: seller.shipping_cool },
  ];
}

export function feePlanRate(key: string): number {
  return siteConfig.feePlans.find((p) => p.key === key)?.rate ?? siteConfig.feePlans[0]?.rate ?? 10;
}

export function randomPin(): string {
  return String(parseInt(randomBytes(4).toString("hex"), 16) % 100_000_000).padStart(8, "0");
}

/** 決済完了（Webhook／モック）からの入金確認。awaiting_payment のときだけ paid にして通知する。 */
export async function confirmOrderPaidBySystem(listingId: number, via: string): Promise<boolean> {
  const db = getDb();
  const o = getOrder(listingId);
  if (!o || o.status !== "awaiting_payment") return false;
  const now = nowIso();
  db.prepare("UPDATE orders SET status = 'paid', paid_via = ?, paid_at = ?, updated_at = ? WHERE listing_id = ? AND status = 'awaiting_payment'").run(via, now, now, listingId);
  const buyer = db.prepare("SELECT id, email, line_user_id FROM users WHERE id = ?").get(o.buyer_id) as { id: number; email: string; line_user_id: string | null };
  const title = (db.prepare("SELECT title FROM listings WHERE id = ?").get(listingId) as { title: string }).title;
  await notifyUser(buyer, "system", `「${title}」のお支払いを確認しました（オンライン決済）。発送までお待ちください。`, listingId);
  return true;
}
