import { randomInt } from "node:crypto";
import { getDb } from "./db.ts";
import { notifyUser } from "./notify.ts";

export const GACHA_COST = 10;

/** 日本時間の日付キー */
export function todayKey(d = new Date()): string {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function points(userId: number): number {
  return (getDb().prepare("SELECT COALESCE(SUM(delta), 0) AS p FROM point_logs WHERE user_id = ?").get(userId) as { p: number }).p;
}

/** ログインボーナス（1日1回、+1ポイント）。受け取れたら true */
export function claimLoginBonus(userId: number): boolean {
  try {
    getDb().prepare("INSERT INTO point_logs (user_id, delta, reason, day) VALUES (?, 1, 'login', ?)").run(userId, todayKey());
    return true;
  } catch {
    return false;
  }
}

export function bonusClaimedToday(userId: number): boolean {
  return !!getDb().prepare("SELECT 1 FROM point_logs WHERE user_id = ? AND reason = 'login' AND day = ?").get(userId, todayKey());
}

export type Prize = { id: number; name: string; weight: number; stock: number | null; active: number };

export function listPrizes(activeOnly = false): Prize[] {
  return getDb().prepare(`SELECT * FROM gacha_prizes ${activeOnly ? "WHERE active = 1 AND (stock IS NULL OR stock > 0)" : ""} ORDER BY id`).all() as Prize[];
}

export function addPrize(name: string, weight: number, stock: number | null): number {
  const r = getDb().prepare("INSERT INTO gacha_prizes (name, weight, stock) VALUES (?, ?, ?)").run(name.trim().slice(0, 60), Math.max(1, weight), stock);
  return Number(r.lastInsertRowid);
}

export function setPrizeActive(id: number, active: boolean): void {
  getDb().prepare("UPDATE gacha_prizes SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
}

/**
 * ガチャを回す。10ポイント消費。景品は重み付き抽選で、「はずれ」も重み付きで含める（MISS_WEIGHT）。
 */
export const MISS_WEIGHT = Number(process.env.GACHA_MISS_WEIGHT ?? 70);

export async function spin(userId: number, rng: () => number = () => randomInt(0, 1_000_000) / 1_000_000): Promise<{ ok: true; won: boolean; prize: string } | { ok: false; error: string }> {
  const db = getDb();
  if (points(userId) < GACHA_COST) return { ok: false, error: `ポイントが足りません（${GACHA_COST}ポイントで1回）。` };
  const prizes = listPrizes(true);
  const total = MISS_WEIGHT + prizes.reduce((a, p) => a + p.weight, 0);
  let r = rng() * total;
  let hit: Prize | null = null;
  if (r >= MISS_WEIGHT) {
    r -= MISS_WEIGHT;
    for (const p of prizes) { if (r < p.weight) { hit = p; break; } r -= p.weight; }
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT INTO point_logs (user_id, delta, reason) VALUES (?, ?, 'gacha')").run(userId, -GACHA_COST);
    db.prepare("INSERT INTO gacha_results (user_id, prize_id, prize_name, won) VALUES (?, ?, ?, ?)").run(userId, hit?.id ?? null, hit?.name ?? "はずれ", hit ? 1 : 0);
    if (hit?.stock != null) db.prepare("UPDATE gacha_prizes SET stock = stock - 1 WHERE id = ?").run(hit.id);
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  if (hit) {
    const u = db.prepare("SELECT id, email, line_user_id FROM users WHERE id = ?").get(userId) as { id: number; email: string; line_user_id: string | null };
    await notifyUser(u, "system", `🎉 ガチャで「${hit.name}」が当たりました！お店から景品の発送についてご連絡します。`);
  }
  return { ok: true, won: !!hit, prize: hit?.name ?? "はずれ" };
}

export function myResults(userId: number, limit = 10) {
  return getDb().prepare("SELECT * FROM gacha_results WHERE user_id = ? ORDER BY id DESC LIMIT ?").all(userId, limit) as { id: number; prize_name: string; won: number; fulfilled: number; created_at: string }[];
}

export function wonResults() {
  return getDb()
    .prepare("SELECT g.*, u.email, u.name, u.shipping_address FROM gacha_results g JOIN users u ON u.id = g.user_id WHERE g.won = 1 ORDER BY g.fulfilled ASC, g.id DESC LIMIT 100")
    .all() as { id: number; prize_name: string; fulfilled: number; created_at: string; email: string; name: string | null; shipping_address: string | null }[];
}

export function markFulfilled(id: number): void {
  getDb().prepare("UPDATE gacha_results SET fulfilled = 1 WHERE id = ?").run(id);
}
