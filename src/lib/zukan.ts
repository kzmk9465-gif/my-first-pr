import { getDb } from "./db.ts";

/** 形質カテゴリ（複合検索用） */
export const TRAIT_GROUPS: { key: string; label: string; items: string[] }[] = [
  { key: "color", label: "体色", items: ["白", "黒", "青", "黄", "朱赤", "オレンジ", "紅白", "三色", "ブラック", "ブルー"] },
  { key: "shine", label: "光・ラメ", items: ["幹之（体外光）", "体内光", "ラメ", "星河", "鱗光", "ヒレ光"] },
  { key: "body", label: "体型", items: ["普通体型", "ダルマ", "半ダルマ", "ヒレ長", "スワロー", "リアルロングフィン", "松井ヒレ長"] },
  { key: "eye", label: "目", items: ["アルビノ", "パンダ", "出目", "スモールアイ"] },
  { key: "pattern", label: "柄・その他", items: ["ブチ", "錦", "透明鱗", "ヒカリ体型", "龍鱗", "琥珀"] },
];

export type Variety = {
  id: number;
  name: string;
  user_id: number | null;
  breeder_name: string | null;
  prefecture: string | null;
  instagram: string | null;
  description: string | null;
  image_url: string | null;
  traits: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export function traitsOf(v: Pick<Variety, "traits">): string[] {
  try { return JSON.parse(v.traits) as string[]; } catch { return []; }
}

export function registerVariety(data: { name: string; user_id: number | null; breeder_name: string; prefecture: string; instagram: string; description: string; image_url: string; traits: string[]; auto_approve?: boolean }): { ok: true; id: number } | { ok: false; error: string } {
  const name = data.name.trim().slice(0, 60);
  if (!name) return { ok: false, error: "品種名は必須です。" };
  const allowed = new Set(TRAIT_GROUPS.flatMap((g) => g.items));
  const traits = [...new Set(data.traits.filter((t) => allowed.has(t)))];
  const r = getDb()
    .prepare("INSERT INTO varieties (name, user_id, breeder_name, prefecture, instagram, description, image_url, traits, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(name, data.user_id, data.breeder_name.trim().slice(0, 60) || null, data.prefecture.trim().slice(0, 10) || null, data.instagram.trim().replace(/^@/, "").slice(0, 60) || null, data.description.trim().slice(0, 2000) || null, data.image_url.trim().slice(0, 500) || null, JSON.stringify(traits), data.auto_approve ? "approved" : "pending");
  return { ok: true, id: Number(r.lastInsertRowid) };
}

export function searchVarieties(q: { keyword?: string; traits?: string[]; limit?: number }): Variety[] {
  const where = ["status = 'approved'"];
  const params: (string | number)[] = [];
  if (q.keyword?.trim()) {
    const like = `%${q.keyword.trim().replace(/[%_]/g, "")}%`;
    where.push("(name LIKE ? OR breeder_name LIKE ? OR description LIKE ?)");
    params.push(like, like, like);
  }
  for (const t of q.traits ?? []) {
    where.push("traits LIKE ?");
    params.push(`%${JSON.stringify(t).slice(1, -1)}%`);
  }
  return getDb().prepare(`SELECT * FROM varieties WHERE ${where.join(" AND ")} ORDER BY name LIMIT ?`).all(...params, q.limit ?? 200) as Variety[];
}

export function getVariety(id: number): Variety | null {
  return (getDb().prepare("SELECT * FROM varieties WHERE id = ?").get(id) as Variety | undefined) ?? null;
}

export function pendingVarieties(): Variety[] {
  return getDb().prepare("SELECT * FROM varieties WHERE status = 'pending' ORDER BY id").all() as Variety[];
}

export function setVarietyStatus(id: number, status: Variety["status"]): void {
  getDb().prepare("UPDATE varieties SET status = ? WHERE id = ?").run(status, id);
}

export function varietiesByUser(userId: number): Variety[] {
  return getDb().prepare("SELECT * FROM varieties WHERE user_id = ? ORDER BY id DESC").all(userId) as Variety[];
}
