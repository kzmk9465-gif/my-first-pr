import { randomInt } from "node:crypto";
import { getDb } from "./db.ts";
import { points } from "./gacha.ts";
import { notifyUser } from "./notify.ts";

/**
 * 播州くじ（オンラインオリパ）。オークションと並ぶ第2の柱。
 * ポイント（point_logs 台帳）を消費して引き、当たった生体は「発送依頼」か
 * 「ポイント還元してもう一度」を選べる。パッケージはコード定義のモックだが、
 * 消費・当選・残り口数・還元は DB（oripa_draws）に記録される実動プロトタイプ。
 */

export type Rarity = "S" | "A" | "B" | "C";

export type PrizeDef = {
  rarity: Rarity;
  name: string;
  /** 市場参考価格（円） */
  refPrice: number;
  /** その場で還元できるポイント */
  redeemPt: number;
  /** 抽選の重み（大きいほど当たりやすい） */
  weight: number;
};

export type OripaPackage = {
  id: string;
  name: string;
  subtitle: string;
  pricePt: number;
  total: number;
  /** カードの色味（グラデ） */
  hue: [string, string];
  /** 目玉（S賞）プレビュー名 */
  highlights: string[];
  prizes: PrizeDef[];
};

export const RARITY_LABEL: Record<Rarity, string> = { S: "S賞", A: "A賞", B: "B賞", C: "C賞" };
export const RARITY_RANK: Record<Rarity, number> = { S: 4, A: 3, B: 2, C: 1 };

/** 販売中のオリパ（モックデータ） */
export const PACKAGES: OripaPackage[] = [
  {
    id: "gokujo-rame",
    name: "播州極上ラメくじ",
    subtitle: "限定100口・目玉は当店自慢のラメ系",
    pricePt: 5000,
    total: 100,
    hue: ["#0ea5b7", "#0284C7"],
    highlights: ["ミッドナイトフリル", "夜桜ゴールド"],
    prizes: [
      { rarity: "S", name: "ミッドナイトフリル 極上オス", refPrice: 120000, redeemPt: 60000, weight: 1 },
      { rarity: "S", name: "夜桜ゴールド 血統ペア", refPrice: 90000, redeemPt: 45000, weight: 1 },
      { rarity: "A", name: "三色ラメ幹之 選抜ペア", refPrice: 28000, redeemPt: 14000, weight: 7 },
      { rarity: "A", name: "紅帝ラメ 当歳オス", refPrice: 20000, redeemPt: 10000, weight: 8 },
      { rarity: "B", name: "ラメ幹之 お楽しみペア", refPrice: 8000, redeemPt: 4000, weight: 30 },
      { rarity: "B", name: "オロチラメ 1ペア", refPrice: 6000, redeemPt: 3000, weight: 25 },
      { rarity: "C", name: "ラメ系 おすすめ1ペア", refPrice: 3000, redeemPt: 2500, weight: 78 },
    ],
  },
  {
    id: "ryusei",
    name: "流星スペシャルくじ",
    subtitle: "お手頃3,000pt・初めての一発に",
    pricePt: 3000,
    total: 150,
    hue: ["#6d5cff", "#3b82f6"],
    highlights: ["流星ラメ", "アルビノ系"],
    prizes: [
      { rarity: "S", name: "流星ラメ 特選オス", refPrice: 60000, redeemPt: 30000, weight: 1 },
      { rarity: "A", name: "アルビノ ロングフィン", refPrice: 16000, redeemPt: 8000, weight: 8 },
      { rarity: "B", name: "みゆき系 お楽しみペア", refPrice: 5000, redeemPt: 2500, weight: 30 },
      { rarity: "C", name: "おすすめ 2ペアセット", refPrice: 2000, redeemPt: 1500, weight: 80 },
    ],
  },
  {
    id: "shuryu",
    name: "朱龍プレミアムくじ",
    subtitle: "一攫千金・1口10,000ptの特大くじ",
    pricePt: 10000,
    total: 50,
    hue: ["#e0565f", "#f0693f"],
    highlights: ["朱龍", "レッドクリフ"],
    prizes: [
      { rarity: "S", name: "朱龍 極上血統ペア", refPrice: 250000, redeemPt: 120000, weight: 1 },
      { rarity: "A", name: "レッドクリフ 選抜オス", refPrice: 45000, redeemPt: 22000, weight: 7 },
      { rarity: "B", name: "紅帝 お楽しみペア", refPrice: 14000, redeemPt: 7000, weight: 32 },
      { rarity: "C", name: "朱系 おすすめ1ペア", refPrice: 6000, redeemPt: 5000, weight: 70 },
    ],
  },
];

export function getPackage(id: string): OripaPackage | null {
  return PACKAGES.find((p) => p.id === id) ?? null;
}

/** 売れた口数 */
export function soldCount(packageId: string): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM oripa_draws WHERE package_id = ?").get(packageId) as { n: number }).n;
}

export function remaining(packageId: string): number {
  const pkg = getPackage(packageId);
  if (!pkg) return 0;
  return Math.max(0, pkg.total - soldCount(packageId));
}

export type DrawResult = { id: number; rarity: Rarity; name: string; refPrice: number; redeemPt: number; status: string };

function pick(pkg: OripaPackage, rng: () => number): PrizeDef {
  const total = pkg.prizes.reduce((a, p) => a + p.weight, 0);
  let r = rng() * total;
  for (const p of pkg.prizes) { if (r < p.weight) return p; r -= p.weight; }
  return pkg.prizes[pkg.prizes.length - 1];
}

/**
 * くじを引く。count 回ぶんのポイントを消費し、当選結果を記録して返す。
 */
export async function draw(
  userId: number,
  packageId: string,
  count: number,
  rng: () => number = () => randomInt(0, 1_000_000) / 1_000_000,
): Promise<{ ok: true; results: DrawResult[]; balance: number; remaining: number } | { ok: false; error: string }> {
  const pkg = getPackage(packageId);
  if (!pkg) return { ok: false, error: "くじが見つかりません。" };
  if (count !== 1 && count !== 10) return { ok: false, error: "引ける回数は1回または10連です。" };
  const left = remaining(packageId);
  if (left < count) return { ok: false, error: left === 0 ? "完売しました。" : `残り ${left} 口です。` };
  const cost = pkg.pricePt * count;
  if (points(userId) < cost) return { ok: false, error: `ポイントが足りません（${cost.toLocaleString("ja-JP")} pt 必要）。` };

  const chosen = Array.from({ length: count }, () => pick(pkg, rng));
  const db = getDb();
  const results: DrawResult[] = [];
  db.exec("BEGIN IMMEDIATE");
  try {
    // 二重確認：トランザクション内で残り口数を再チェック
    const soldNow = (db.prepare("SELECT COUNT(*) AS n FROM oripa_draws WHERE package_id = ?").get(packageId) as { n: number }).n;
    if (pkg.total - soldNow < count) { db.exec("ROLLBACK"); return { ok: false, error: "ちょうど完売しました。" }; }
    db.prepare("INSERT INTO point_logs (user_id, delta, reason) VALUES (?, ?, 'oripa')").run(userId, -cost);
    const ins = db.prepare("INSERT INTO oripa_draws (user_id, package_id, rarity, prize_name, ref_price, redeem_pt) VALUES (?, ?, ?, ?, ?, ?)");
    for (const p of chosen) {
      const r = ins.run(userId, packageId, p.rarity, p.name, p.refPrice, p.redeemPt);
      results.push({ id: Number(r.lastInsertRowid), rarity: p.rarity, name: p.name, refPrice: p.refPrice, redeemPt: p.redeemPt, status: "won" });
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  const best = results.reduce((a, b) => (RARITY_RANK[b.rarity] > RARITY_RANK[a.rarity] ? b : a), results[0]);
  if (best.rarity === "S" || best.rarity === "A") {
    const u = db.prepare("SELECT id, email, line_user_id FROM users WHERE id = ?").get(userId) as { id: number; email: string; line_user_id: string | null };
    await notifyUser(u, "system", `🎉 播州くじ「${pkg.name}」で ${RARITY_LABEL[best.rarity]}「${best.name}」が当選しました！`).catch(() => {});
  }
  return { ok: true, results, balance: points(userId), remaining: remaining(packageId) };
}

/** 当選した生体をその場でポイント還元する。 */
export function redeem(userId: number, drawIds: number[]): { ok: true; gained: number; balance: number } | { ok: false; error: string } {
  const db = getDb();
  let gained = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const id of drawIds) {
      const row = db.prepare("SELECT id, status, redeem_pt FROM oripa_draws WHERE id = ? AND user_id = ?").get(id, userId) as { id: number; status: string; redeem_pt: number } | undefined;
      if (!row || row.status !== "won") continue;
      db.prepare("UPDATE oripa_draws SET status = 'redeemed' WHERE id = ?").run(id);
      db.prepare("INSERT INTO point_logs (user_id, delta, reason) VALUES (?, ?, 'oripa_redeem')").run(userId, row.redeem_pt);
      gained += row.redeem_pt;
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return { ok: true, gained, balance: points(userId) };
}

/** 当選した生体の発送を依頼する。 */
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
  if (names.length === 0) return { ok: false, error: "発送対象がありません。" };
  const u = db.prepare("SELECT id, email, line_user_id FROM users WHERE id = ?").get(userId) as { id: number; email: string; line_user_id: string | null };
  await notifyUser(u, "system", `播州くじの発送依頼を受け付けました（${names.length}点）。生体便の手配後にご連絡します。`).catch(() => {});
  return { ok: true, count: names.length };
}

export type MyOripaWin = { id: number; package_id: string; rarity: Rarity; prize_name: string; ref_price: number; redeem_pt: number; status: string; created_at: string };

/** マイページ用：当選履歴 */
export function myWins(userId: number, limit = 50): MyOripaWin[] {
  return getDb().prepare("SELECT * FROM oripa_draws WHERE user_id = ? ORDER BY id DESC LIMIT ?").all(userId, limit) as MyOripaWin[];
}
