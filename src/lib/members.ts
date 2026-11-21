import { getDb, nowIso } from "./db.ts";
import { siteConfig } from "./config.ts";

export type User = {
  id: number;
  email: string;
  name: string | null;
  role: "user" | "admin";
  status: "pending" | "approved" | "blocked";
  shop_name: string | null;
  instagram: string | null;
  approved_at: string | null;
  line_user_id: string | null;
  shipping_name: string | null;
  shipping_postal: string | null;
  shipping_address: string | null;
  shipping_phone: string | null;
  created_at: string;
};

/** 会員登録フォーム（氏名・屋号・Instagram・発送先）の保存。承認待ちにする。 */
export function registerProfile(
  userId: number,
  data: { name: string; shop_name: string; instagram: string; shipping_name: string; shipping_postal: string; shipping_address: string; shipping_phone: string },
): void {
  getDb()
    .prepare(
      `UPDATE users SET name = ?, shop_name = ?, instagram = ?, shipping_name = ?, shipping_postal = ?, shipping_address = ?, shipping_phone = ? WHERE id = ?`,
    )
    .run(data.name, data.shop_name || null, data.instagram || null, data.shipping_name, data.shipping_postal, data.shipping_address, data.shipping_phone, userId);
}

/** 登録フォームが未入力か（氏名と住所が無ければ /register へ誘導する） */
export function needsRegistration(u: Pick<User, "name" | "shipping_address">): boolean {
  return !u.name || !u.shipping_address;
}

/** 入札できる状態か */
export function canBid(u: Pick<User, "status" | "role">): boolean {
  if (u.status === "blocked") return false;
  if (u.role === "admin") return true;
  return !siteConfig.requireApproval || u.status === "approved";
}

export function setUserStatus(userId: number, status: User["status"]): void {
  getDb()
    .prepare("UPDATE users SET status = ?, approved_at = CASE WHEN ? = 'approved' THEN ? ELSE approved_at END WHERE id = ?")
    .run(status, status, nowIso(), userId);
}

export function listMembers(filter: "pending" | "approved" | "blocked" | "all" = "all"): User[] {
  const where = filter === "all" ? "" : "WHERE status = ?";
  const params = filter === "all" ? [] : [filter];
  return getDb().prepare(`SELECT * FROM users ${where} ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, id DESC`).all(...params) as User[];
}
