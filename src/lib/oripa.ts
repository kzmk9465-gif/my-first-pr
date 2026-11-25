import { randomBytes, randomInt } from "node:crypto";
import { getDb, nowIso } from "./db.ts";
import { notifyUser } from "./notify.ts";

/**
 * 播州くじ（オンラインくじ）確定版（2026-11-25 設計）。
 *
 * - 汎用ポイントは売らない。特定のくじの「口」を都度購入する（oripa_orders）。
 * - 有限の箱：総口数と各賞の本数を先に決め、引いた分だけ減る（非復元抽出）。
 *   「100口にS賞2本」が文字どおり真になる。残り口数・各賞の残本数は画面に出す。
 * - 当選品は必ず発送する。ポイント還元・買い戻し・現金化はしない（賭博罪・景表法への防御）。
 * - 18歳未満は購入できない。
 * - 決済手段: bank（銀行振込・お店が入金確認）／ mock（お試し環境のテスト決済）／ psp（決済代行・今後）。
 */

export type Rarity = "S" | "A" | "B" | "C";
export type PrizeKind = "medaka" | "goods" | "card";

export const RARITY_LABEL: Record<Rarity, string> = { S: "S賞", A: "A賞", B: "B賞", C: "C賞" };
export const RARITY_RANK: Record<Rarity, number> = { S: 4, A: 3, B: 2, C: 1 };
export const KIND_LABEL: Record<PrizeKind, string> = { medaka: "メダカ（生体）", goods: "用品", card: "カード" };

/** 未入金の注文を無効にするまでの日数 */
export const ORDER_EXPIRE_DAYS = 3;
/** 1回の購入で買える口数 */
export const MAX_COUNT_PER_ORDER = 10;
/** 当選品の発送依頼をしないまま権利放棄になる日数（規約に明記） */
export const CLAIM_DAYS = 30;

export type OripaPackage = {
  id: number;
  slug: string;
  name: string;
  subtitle: string;
  price_yen: number;
  total: number;
  hue1: string;
  hue2: string;
  status: "open" | "closed";
  created_at: string;
};

export type OripaPrize = {
  id: number;
  package_id: number;
  rarity: Rarity;
  name: string;
  kind: PrizeKind;
  ref_price: number;
  image_url: string | null;
  count_total: number;
  count_left: number;
};

export type OripaOrder = {
  id: number;
  token: string;
  user_id: number;
  package_id: number;
  count: number;
  amount_yen: number;
  provider: "bank" | "mock" | "psp";
  status: "pending" | "paid" | "cancelled" | "expired";
  drawn: number;
  created_at: string;
  paid_at: string | null;
};

export type DrawResult = { id: number; rarity: Rarity; name: string; kind: PrizeKind; refPrice: number; imageUrl: string | null; status: string };

/** 決済手段。DEMO_MODE=1 のお試し環境ではテスト決済、本番は銀行振込（決済代行は接続後に psp） */
export function oripaProvider(): "bank" | "mock" {
  return process.env.DEMO_MODE === "1" || process.env.NODE_ENV !== "production" ? "mock" : "bank";
}

/** 生年月日（YYYY-MM-DD）から18歳以上か */
export function isAdult(birthdate: string | null | undefined, now = new Date()): boolean {
  if (!birthdate) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate);
  if (!m) return false;
  const b = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(b.getTime())) return false;
  const eighteen = new Date(Date.UTC(b.getUTCFullYear() + 18, b.getUTCMonth(), b.getUTCDate()));
  return now.getTime() >= eighteen.getTime();
}

// ---- くじ（パッケージ）----

export function listPackages(openOnly = true): OripaPackage[] {
  return getDb().prepare(`SELECT * FROM oripa_packages ${openOnly ? "WHERE status = 'open'" : ""} ORDER BY id`).all() as OripaPackage[];
}

export function getPackage(slug: string): OripaPackage | null {
  return (getDb().prepare("SELECT * FROM oripa_packages WHERE slug = ?").get(slug) as OripaPackage | undefined) ?? null;
}

export function getPackageById(id: number): OripaPackage | null {
  return (getDb().prepare("SELECT * FROM oripa_packages WHERE id = ?").get(id) as OripaPackage | undefined) ?? null;
}

export function listPrizes(packageId: number): OripaPrize[] {
  return getDb().prepare("SELECT * FROM oripa_prizes WHERE package_id = ? ORDER BY CASE rarity WHEN 'S' THEN 0 WHEN 'A' THEN 1 WHEN 'B' THEN 2 ELSE 3 END, id").all(packageId) as OripaPrize[];
}

export function createPackage(data: { slug: string; name: string; subtitle?: string; price_yen: number; total: number; hue1?: string; hue2?: string }): number {
  const r = getDb()
    .prepare("INSERT INTO oripa_packages (slug, name, subtitle, price_yen, total, hue1, hue2) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(data.slug, data.name, data.subtitle ?? "", data.price_yen, data.total, data.hue1 ?? "#0ea5b7", data.hue2 ?? "#0284C7");
  return Number(r.lastInsertRowid);
}

export function setPackageStatus(id: number, status: "open" | "closed"): void {
  getDb().prepare("UPDATE oripa_packages SET status = ? WHERE id = ?").run(status, id);
}

export function addPrize(packageId: number, data: { rarity: Rarity; name: string; kind?: PrizeKind; ref_price?: number; image_url?: string | null; count: number }): number {
  const r = getDb()
    .prepare("INSERT INTO oripa_prizes (package_id, rarity, name, kind, ref_price, image_url, count_total, count_left) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(packageId, data.rarity, data.name, data.kind ?? "medaka", data.ref_price ?? 0, data.image_url ?? null, data.count, data.count);
  return Number(r.lastInsertRowid);
}

/** 当選が出ていない賞だけ削除できる */
export function deletePrize(id: number): boolean {
  const used = getDb().prepare("SELECT COUNT(*) AS n FROM oripa_draws WHERE prize_id = ?").get(id) as { n: number };
  if (used.n > 0) return false;
  getDb().prepare("DELETE FROM oripa_prizes WHERE id = ?").run(id);
  return true;
}

/** 賞の本数の合計（＝箱の中身）。総口数と一致していないと販売できない */
export function prizeTotal(packageId: number): number {
  return (getDb().prepare("SELECT COALESCE(SUM(count_total),0) AS n FROM oripa_prizes WHERE package_id = ?").get(packageId) as { n: number }).n;
}

/** 箱の中身が総口数と一致しているか（一致していないくじは販売できない） */
export function isSellable(pkg: OripaPackage): boolean {
  return pkg.status === "open" && pkg.total > 0 && prizeTotal(pkg.id) === pkg.total;
}

// ---- 口の購入 ----

function expirePending(db = getDb()): void {
  db.prepare(`UPDATE oripa_orders SET status = 'expired' WHERE status = 'pending' AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)`).run(`-${ORDER_EXPIRE_DAYS} days`);
}

/** 売れた口数（入金済み＋入金待ちの予約ぶん） */
export function soldCount(packageId: number): number {
  const db = getDb();
  expirePending(db);
  return (db.prepare("SELECT COALESCE(SUM(count),0) AS n FROM oripa_orders WHERE package_id = ? AND status IN ('paid','pending')").get(packageId) as { n: number }).n;
}

export function remaining(packageId: number): number {
  const pkg = getPackageById(packageId);
  if (!pkg) return 0;
  return Math.max(0, pkg.total - soldCount(packageId));
}

function genToken(): string {
  return "kuji_" + randomBytes(12).toString("hex");
}

/**
 * 口を買う（注文を作る）。provider が bank なら入金待ち、mock ならテスト決済画面へ。
 * ここでは口を「予約」するだけで、引けるのは入金確認（paid）後。
 */
export function createOrder(
  user: { id: number; birthdate: string | null },
  slug: string,
  count: number,
  provider: "bank" | "mock" = oripaProvider(),
): { ok: true; token: string; amount: number } | { ok: false; error: string } {
  const pkg = getPackage(slug);
  if (!pkg) return { ok: false, error: "くじが見つかりません。" };
  if (!isSellable(pkg)) return { ok: false, error: "このくじは現在販売していません。" };
  if (!isAdult(user.birthdate)) return { ok: false, error: "播州くじは18歳以上の方のみご購入いただけます。マイページの会員情報で生年月日をご確認ください。" };
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT_PER_ORDER) return { ok: false, error: `1回に買える口数は1〜${MAX_COUNT_PER_ORDER}口です。` };
  const db = getDb();
  const token = genToken();
  db.exec("BEGIN IMMEDIATE");
  try {
    expirePending(db);
    const sold = (db.prepare("SELECT COALESCE(SUM(count),0) AS n FROM oripa_orders WHERE package_id = ? AND status IN ('paid','pending')").get(pkg.id) as { n: number }).n;
    const left = pkg.total - sold;
    if (left < count) { db.exec("ROLLBACK"); return { ok: false, error: left <= 0 ? "完売しました。" : `残り ${left} 口です。` }; }
    db.prepare("INSERT INTO oripa_orders (token, user_id, package_id, count, amount_yen, provider, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')")
      .run(token, user.id, pkg.id, count, pkg.price_yen * count, provider);
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  return { ok: true, token, amount: pkg.price_yen * count };
}

export function getOrder(token: string): OripaOrder | null {
  return (getDb().prepare("SELECT * FROM oripa_orders WHERE token = ?").get(token) as OripaOrder | undefined) ?? null;
}

/**
 * 入金確認。pending の行だけを条件付き UPDATE するので、Webhook の再送や二重クリックでも二重に有効化されない。
 * 返り値 true = この呼び出しで paid にした。
 */
export function markOrderPaid(token: string): boolean {
  const r = getDb().prepare("UPDATE oripa_orders SET status = 'paid', paid_at = ? WHERE token = ? AND status = 'pending'").run(nowIso(), token);
  return Number(r.changes) === 1;
}

export function cancelOrder(token: string): boolean {
  const r = getDb().prepare("UPDATE oripa_orders SET status = 'cancelled' WHERE token = ? AND status = 'pending'").run(token);
  return Number(r.changes) === 1;
}

export type OrderView = OripaOrder & { package_name: string; package_slug: string; price_yen: number };

/** 会員の注文（くじ名付き） */
export function myOrders(userId: number, limit = 20): OrderView[] {
  expirePending();
  return getDb()
    .prepare("SELECT o.*, p.name AS package_name, p.slug AS package_slug, p.price_yen FROM oripa_orders o JOIN oripa_packages p ON p.id = o.package_id WHERE o.user_id = ? ORDER BY o.id DESC LIMIT ?")
    .all(userId, limit) as OrderView[];
}

/** 引ける口が残っている入金済み注文 */
export function drawableOrders(userId: number): OripaOrder[] {
  return getDb().prepare("SELECT * FROM oripa_orders WHERE user_id = ? AND status = 'paid' AND drawn < count ORDER BY id").all(userId) as OripaOrder[];
}

/** 管理：入金待ちの注文 */
export function pendingOrders(): (OripaOrder & { email: string; name: string | null; package_name: string })[] {
  expirePending();
  return getDb()
    .prepare("SELECT o.*, u.email, u.name, p.name AS package_name FROM oripa_orders o JOIN users u ON u.id = o.user_id JOIN oripa_packages p ON p.id = o.package_id WHERE o.status = 'pending' ORDER BY o.id")
    .all() as (OripaOrder & { email: string; name: string | null; package_name: string })[];
}

// ---- 抽選（非復元）----

function pickPrize(prizes: OripaPrize[], rng: () => number): OripaPrize {
  const alive = prizes.filter((p) => p.count_left > 0);
  const total = alive.reduce((a, p) => a + p.count_left, 0);
  let r = rng() * total;
  for (const p of alive) { if (r < p.count_left) return p; r -= p.count_left; }
  return alive[alive.length - 1];
}

/**
 * 入金済みの注文から n 口ぶん引く。各賞の残本数で重み付けし、引いた賞の残本数を1減らす（非復元抽出）。
 */
export async function draw(
  userId: number,
  orderToken: string,
  n: number,
  rng: () => number = () => randomInt(0, 1_000_000) / 1_000_000,
): Promise<{ ok: true; results: DrawResult[]; left: number; remaining: number } | { ok: false; error: string }> {
  if (!Number.isInteger(n) || n < 1 || n > MAX_COUNT_PER_ORDER) return { ok: false, error: "引く口数が正しくありません。" };
  const db = getDb();
  const results: DrawResult[] = [];
  let pkgId = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    const order = db.prepare("SELECT * FROM oripa_orders WHERE token = ? AND user_id = ?").get(orderToken, userId) as OripaOrder | undefined;
    if (!order) { db.exec("ROLLBACK"); return { ok: false, error: "注文が見つかりません。" }; }
    if (order.status !== "paid") { db.exec("ROLLBACK"); return { ok: false, error: order.status === "pending" ? "入金確認後に引けます。" : "この注文は無効です。" }; }
    if (order.drawn + n > order.count) { db.exec("ROLLBACK"); return { ok: false, error: `この注文で引けるのは残り ${order.count - order.drawn} 口です。` }; }
    pkgId = order.package_id;
    const pkg = db.prepare("SELECT * FROM oripa_packages WHERE id = ?").get(pkgId) as OripaPackage;
    const prizes = db.prepare("SELECT * FROM oripa_prizes WHERE package_id = ?").all(pkgId) as OripaPrize[];
    const left = prizes.reduce((a, p) => a + p.count_left, 0);
    if (left < n) { db.exec("ROLLBACK"); return { ok: false, error: "賞品の残りが足りません。お店にご連絡ください。" }; }
    const ins = db.prepare("INSERT INTO oripa_draws (user_id, package_id, rarity, prize_name, ref_price, redeem_pt, status, order_id, prize_id, kind) VALUES (?, ?, ?, ?, ?, 0, 'won', ?, ?, ?)");
    const dec = db.prepare("UPDATE oripa_prizes SET count_left = count_left - 1 WHERE id = ? AND count_left > 0");
    for (let i = 0; i < n; i++) {
      const p = pickPrize(prizes, rng);
      const d = dec.run(p.id);
      if (Number(d.changes) !== 1) throw new Error("prize underflow");
      p.count_left -= 1;
      const r = ins.run(userId, pkg.slug, p.rarity, p.name, p.ref_price, order.id, p.id, p.kind);
      results.push({ id: Number(r.lastInsertRowid), rarity: p.rarity, name: p.name, kind: p.kind, refPrice: p.ref_price, imageUrl: p.image_url, status: "won" });
    }
    db.prepare("UPDATE oripa_orders SET drawn = drawn + ? WHERE id = ?").run(n, order.id);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  const order = getOrder(orderToken)!;
  const best = results.reduce((a, b) => (RARITY_RANK[b.rarity] > RARITY_RANK[a.rarity] ? b : a), results[0]);
  if (best.rarity === "S" || best.rarity === "A") {
    const u = db.prepare("SELECT id, email, line_user_id FROM users WHERE id = ?").get(userId) as { id: number; email: string; line_user_id: string | null };
    const pkg = getPackageById(pkgId)!;
    await notifyUser(u, "system", `🎉 播州くじ「${pkg.name}」で ${RARITY_LABEL[best.rarity]}「${best.name}」が当選しました！マイページから発送依頼をしてください。`).catch(() => {});
  }
  return { ok: true, results, left: order.count - order.drawn, remaining: remaining(pkgId) };
}

/** 当選品の発送を依頼する。 */
export async function requestShipping(userId: number, drawIds: number[]): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const db = getDb();
  const names: string[] = [];
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const id of drawIds) {
      const row = db.prepare("SELECT id, status, prize_name FROM oripa_draws WHERE id = ? AND user_id = ?").get(id, userId) as { id: number; status: string; prize_name: string } | undefined;
      if (!row || row.status !== "won") continue;
      db.prepare("UPDATE oripa_draws SET status = 'ship_requested' WHERE id = ?").run(id);
      names.push(row.prize_name);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  if (names.length === 0) return { ok: false, error: "発送依頼できる当選品がありません。" };
  const u = db.prepare("SELECT id, email, line_user_id FROM users WHERE id = ?").get(userId) as { id: number; email: string; line_user_id: string | null };
  await notifyUser(u, "system", `📦 播州くじの当選品（${names.slice(0, 3).join("・")}${names.length > 3 ? ` ほか${names.length - 3}点` : ""}）の発送依頼を受け付けました。発送までお待ちください。`).catch(() => {});
  return { ok: true, count: names.length };
}

export function markDrawShipped(drawId: number): void {
  getDb().prepare("UPDATE oripa_draws SET status = 'shipped' WHERE id = ? AND status = 'ship_requested'").run(drawId);
}

export type WinRow = { id: number; package_id: string; rarity: Rarity; prize_name: string; kind: PrizeKind; ref_price: number; status: string; created_at: string };

export function myWins(userId: number, limit = 20): WinRow[] {
  return getDb().prepare("SELECT id, package_id, rarity, prize_name, kind, ref_price, status, created_at FROM oripa_draws WHERE user_id = ? ORDER BY id DESC LIMIT ?").all(userId, limit) as WinRow[];
}

/** 当選したまま発送依頼をしていない品（まとめて依頼できるように） */
export function unclaimedWins(userId: number): WinRow[] {
  return getDb().prepare("SELECT id, package_id, rarity, prize_name, kind, ref_price, status, created_at FROM oripa_draws WHERE user_id = ? AND status = 'won' ORDER BY id DESC").all(userId) as WinRow[];
}

export type ShipRequestRow = WinRow & { email: string; name: string | null; shipping_name: string | null; shipping_postal: string | null; shipping_address: string | null; shipping_phone: string | null };

/** 管理：発送依頼が来ている当選品 */
export function shippingRequests(): ShipRequestRow[] {
  return getDb()
    .prepare("SELECT d.id, d.package_id, d.rarity, d.prize_name, d.kind, d.ref_price, d.status, d.created_at, u.email, u.name, u.shipping_name, u.shipping_postal, u.shipping_address, u.shipping_phone FROM oripa_draws d JOIN users u ON u.id = d.user_id WHERE d.status = 'ship_requested' ORDER BY d.id")
    .all() as ShipRequestRow[];
}

/** 画面用：くじ一覧（残り口数・各賞の残本数つき） */
export type PackageView = OripaPackage & { remaining: number; sellable: boolean; prizes: OripaPrize[] };

export function packageViews(openOnly = true): PackageView[] {
  return listPackages(openOnly).map((p) => ({ ...p, remaining: remaining(p.id), sellable: isSellable(p), prizes: listPrizes(p.id) }));
}
