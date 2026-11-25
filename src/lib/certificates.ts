import { randomBytes } from "node:crypto";
import { getDb, nowIso } from "./db.ts";
import { getOrder } from "./sellers.ts";
import { notifyUser } from "./notify.ts";

export type Certificate = {
  id: number;
  code: string;
  type: "sale" | "secondary";
  status: "issued" | "pending" | "rejected";
  listing_id: number | null;
  parent_id: number | null;
  user_id: number;
  holder_name: string | null;
  title: string;
  variety: string | null;
  breeder: string | null;
  seller_name: string | null;
  price: number | null;
  note: string | null;
  issued_at: string | null;
  created_at: string;
};

function genCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += alphabet[b[i] % alphabet.length];
  return `BM-${s.slice(0, 4)}-${s.slice(4)}`;
}

export function getCertificate(code: string): Certificate | null {
  return (getDb().prepare("SELECT * FROM certificates WHERE code = ?").get(code.trim().toUpperCase()) as Certificate | undefined) ?? null;
}

export function getCertificateById(id: number): Certificate | null {
  return (getDb().prepare("SELECT * FROM certificates WHERE id = ?").get(id) as Certificate | undefined) ?? null;
}

export function certificateForListing(listingId: number): Certificate | null {
  return (getDb().prepare("SELECT * FROM certificates WHERE listing_id = ? AND type = 'sale'").get(listingId) as Certificate | undefined) ?? null;
}

export function myCertificates(userId: number): Certificate[] {
  return getDb().prepare("SELECT * FROM certificates WHERE user_id = ? ORDER BY id DESC").all(userId) as Certificate[];
}

/**
 * 落札販売証明書の発行。落札者本人が、入金確認以降に発行できる。既にあればそれを返す。
 */
export function issueSaleCertificate(listingId: number, userId: number): { ok: true; cert: Certificate } | { ok: false; error: string } {
  const db = getDb();
  const existing = certificateForListing(listingId);
  if (existing) return existing.user_id === userId ? { ok: true, cert: existing } : { ok: false, error: "この出品の証明書は他の会員に発行済みです。" };
  const l = db.prepare("SELECT l.*, s.name AS seller_name FROM listings l JOIN sellers s ON s.id = l.seller_id WHERE l.id = ?").get(listingId) as
    | { id: number; title: string; variety: string | null; breeder: string | null; seller_name: string; current_price: number; winner_id: number | null; status: string }
    | undefined;
  if (!l || l.status !== "ended" || l.winner_id !== userId) return { ok: false, error: "この出品の落札者ではありません。" };
  const o = getOrder(listingId);
  if (!o || !["paid", "shipped", "completed"].includes(o.status)) return { ok: false, error: "ご入金の確認後に発行できます。" };
  const u = db.prepare("SELECT name, shop_name FROM users WHERE id = ?").get(userId) as { name: string | null; shop_name: string | null };
  let code = genCode();
  while (db.prepare("SELECT 1 FROM certificates WHERE code = ?").get(code)) code = genCode();
  db.prepare(
    `INSERT INTO certificates (code, type, status, listing_id, user_id, holder_name, title, variety, breeder, seller_name, price, issued_at)
     VALUES (?, 'sale', 'issued', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(code, listingId, userId, u.shop_name || u.name, l.title, l.variety, l.breeder, l.seller_name, l.current_price, nowIso());
  return { ok: true, cert: getCertificate(code)! };
}

/**
 * 二次販売証明の申請。落札個体から殖やした子を売る時に、親証明を持つ本人が申請し、お店が確認して発行する。
 */
export function applySecondaryCertificate(parentCode: string, userId: number, data: { title: string; note: string }): { ok: true; cert: Certificate } | { ok: false; error: string } {
  const db = getDb();
  const parent = getCertificate(parentCode);
  if (!parent || parent.user_id !== userId) return { ok: false, error: "親となる証明書が見つからないか、あなたの所有ではありません。" };
  if (parent.status !== "issued") return { ok: false, error: "発行済みの証明書からのみ申請できます。" };
  if (!data.title.trim()) return { ok: false, error: "販売する個体の説明を入力してください。" };
  const u = db.prepare("SELECT name, shop_name FROM users WHERE id = ?").get(userId) as { name: string | null; shop_name: string | null };
  let code = genCode();
  while (db.prepare("SELECT 1 FROM certificates WHERE code = ?").get(code)) code = genCode();
  db.prepare(
    `INSERT INTO certificates (code, type, status, parent_id, user_id, holder_name, title, variety, breeder, seller_name, note)
     VALUES (?, 'secondary', 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(code, parent.id, userId, u.shop_name || u.name, data.title.trim().slice(0, 120), parent.variety, parent.breeder, u.shop_name || u.name, data.note.trim().slice(0, 500) || null);
  return { ok: true, cert: getCertificate(code)! };
}

export function pendingSecondaryCertificates(): (Certificate & { email: string; parent_code: string })[] {
  return getDb()
    .prepare(
      `SELECT c.*, u.email, p.code AS parent_code FROM certificates c JOIN users u ON u.id = c.user_id LEFT JOIN certificates p ON p.id = c.parent_id
       WHERE c.status = 'pending' ORDER BY c.id ASC`,
    )
    .all() as (Certificate & { email: string; parent_code: string })[];
}

export async function reviewSecondaryCertificate(id: number, approve: boolean): Promise<boolean> {
  const db = getDb();
  const c = getCertificateById(id);
  if (!c || c.status !== "pending") return false;
  db.prepare("UPDATE certificates SET status = ?, issued_at = ? WHERE id = ?").run(approve ? "issued" : "rejected", approve ? nowIso() : null, id);
  const u = db.prepare("SELECT id, email, line_user_id FROM users WHERE id = ?").get(c.user_id) as { id: number; email: string; line_user_id: string | null };
  await notifyUser(u, "system", approve ? `二次販売証明 ${c.code} を発行しました。` : `二次販売証明の申請（${c.title}）は承認されませんでした。`);
  return true;
}

/** 証明書の系図（本人 → 親 → 祖 …）。先頭が指定した証明書。 */
export function lineage(cert: Certificate): Certificate[] {
  const chain: Certificate[] = [cert];
  let cur = cert;
  while (cur.parent_id && chain.length < 20) {
    const p = getCertificateById(cur.parent_id);
    if (!p) break;
    chain.push(p);
    cur = p;
  }
  return chain;
}

/** 証明書から派生した子証明 */
export function children(cert: Certificate): Certificate[] {
  return getDb().prepare("SELECT * FROM certificates WHERE parent_id = ? AND status = 'issued' ORDER BY id").all(cert.id) as Certificate[];
}
