import { getDb } from "./db.ts";

export type Contest = { id: number; title: string; description: string | null; status: "entry" | "voting" | "closed"; created_at: string };
export type Entry = { id: number; contest_id: number; user_id: number; title: string; image_url: string | null; description: string | null; created_at: string; entrant: string; votes: number };

export function createContest(title: string, description: string): number {
  const r = getDb().prepare("INSERT INTO contests (title, description) VALUES (?, ?)").run(title.trim().slice(0, 100), description.trim().slice(0, 2000) || null);
  return Number(r.lastInsertRowid);
}

export function setContestStatus(id: number, status: Contest["status"]): void {
  getDb().prepare("UPDATE contests SET status = ? WHERE id = ?").run(status, id);
}

export function listContests(): Contest[] {
  return getDb().prepare("SELECT * FROM contests ORDER BY CASE status WHEN 'voting' THEN 0 WHEN 'entry' THEN 1 ELSE 2 END, id DESC").all() as Contest[];
}

export function getContest(id: number): Contest | null {
  return (getDb().prepare("SELECT * FROM contests WHERE id = ?").get(id) as Contest | undefined) ?? null;
}

export function entries(contestId: number): Entry[] {
  return getDb()
    .prepare(
      `SELECT e.*, COALESCE(u.shop_name, u.name, '会員' || u.id) AS entrant,
              (SELECT COUNT(*) FROM contest_votes v WHERE v.entry_id = e.id) AS votes
       FROM contest_entries e JOIN users u ON u.id = e.user_id WHERE e.contest_id = ? ORDER BY votes DESC, e.id ASC`,
    )
    .all(contestId) as Entry[];
}

export function enter(contestId: number, userId: number, data: { title: string; image_url: string; description: string }): { ok: true; id: number } | { ok: false; error: string } {
  const c = getContest(contestId);
  if (!c || c.status !== "entry") return { ok: false, error: "現在エントリーは受け付けていません。" };
  if (!data.title.trim()) return { ok: false, error: "個体名を入力してください。" };
  const count = (getDb().prepare("SELECT COUNT(*) AS c FROM contest_entries WHERE contest_id = ? AND user_id = ?").get(contestId, userId) as { c: number }).c;
  if (count >= 3) return { ok: false, error: "エントリーは1人3点までです。" };
  const r = getDb().prepare("INSERT INTO contest_entries (contest_id, user_id, title, image_url, description) VALUES (?, ?, ?, ?, ?)").run(contestId, userId, data.title.trim().slice(0, 80), data.image_url.trim().slice(0, 500) || null, data.description.trim().slice(0, 1000) || null);
  return { ok: true, id: Number(r.lastInsertRowid) };
}

/** 投票は1人1票。自分の出品には投票できない。投票期間中なら票を変えられる。 */
export function vote(contestId: number, entryId: number, userId: number): { ok: true } | { ok: false; error: string } {
  const c = getContest(contestId);
  if (!c || c.status !== "voting") return { ok: false, error: "現在投票は受け付けていません。" };
  const e = getDb().prepare("SELECT user_id FROM contest_entries WHERE id = ? AND contest_id = ?").get(entryId, contestId) as { user_id: number } | undefined;
  if (!e) return { ok: false, error: "エントリーが見つかりません。" };
  if (e.user_id === userId) return { ok: false, error: "自分のエントリーには投票できません。" };
  getDb().prepare("INSERT INTO contest_votes (contest_id, entry_id, user_id) VALUES (?, ?, ?) ON CONFLICT(contest_id, user_id) DO UPDATE SET entry_id = excluded.entry_id, created_at = excluded.created_at").run(contestId, entryId, userId);
  return { ok: true };
}

export function myVote(contestId: number, userId: number): number | null {
  const r = getDb().prepare("SELECT entry_id FROM contest_votes WHERE contest_id = ? AND user_id = ?").get(contestId, userId) as { entry_id: number } | undefined;
  return r?.entry_id ?? null;
}
