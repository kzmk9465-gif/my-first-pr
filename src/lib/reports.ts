import { getDb } from "./db.ts";

export function reportListing(listingId: number, userId: number, reason: string): { ok: true } | { ok: false; error: string } {
  const text = reason.trim().slice(0, 500);
  if (!text) return { ok: false, error: "通報の理由を入力してください。" };
  const dup = getDb().prepare("SELECT 1 FROM reports WHERE listing_id = ? AND user_id = ? AND handled = 0").get(listingId, userId);
  if (dup) return { ok: false, error: "この出品は既に通報済みです。運営が確認中です。" };
  getDb().prepare("INSERT INTO reports (listing_id, user_id, reason) VALUES (?, ?, ?)").run(listingId, userId, text);
  return { ok: true };
}

export function openReports() {
  return getDb()
    .prepare("SELECT r.*, l.title, u.email FROM reports r JOIN listings l ON l.id = r.listing_id JOIN users u ON u.id = r.user_id WHERE r.handled = 0 ORDER BY r.id")
    .all() as { id: number; listing_id: number; reason: string; created_at: string; title: string; email: string }[];
}

export function handleReport(id: number): void {
  getDb().prepare("UPDATE reports SET handled = 1 WHERE id = ?").run(id);
}
