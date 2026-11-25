import { cookies } from "next/headers";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { getDb, nowIso } from "./db.ts";
import { siteConfig } from "./config.ts";
import { mailProvider, sendMail } from "./mail.ts";
import { pushLine } from "./notify.ts";

export type { User } from "./members.ts";
import type { User } from "./members.ts";

const SESSION_COOKIE = "banshu_session";
const SESSION_DAYS = 30;
const OTP_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

function hashCode(email: string, code: string): string {
  const salt = process.env.OTP_SALT ?? "banshu-dev-salt";
  return createHash("sha256").update(`${salt}:${email}:${code}`).digest("hex");
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** 認証コードを発行してメール送信する。開発時はコードを返す。 */
export async function requestOtp(emailRaw: string): Promise<{ debugCode?: string }> {
  const email = normalizeEmail(emailRaw);
  const db = getDb();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expires = new Date(Date.now() + OTP_MINUTES * 60_000).toISOString();
  db.prepare("UPDATE otp_codes SET consumed = 1 WHERE email = ? AND consumed = 0").run(email);
  db.prepare("INSERT INTO otp_codes (email, code_hash, expires_at) VALUES (?, ?, ?)").run(
    email,
    hashCode(email, code),
    expires,
  );
  await sendMail(
    email,
    `【${siteConfig.auctionName}】ログイン認証コード`,
    `認証コード: ${code}\n\n${OTP_MINUTES}分以内に入力してください。\nこのメールに覚えがない場合は破棄してください。`,
  );
  // LINE連携済みなら LINE にも届ける（メールを開く手間を省く）
  const linked = db.prepare("SELECT line_user_id FROM users WHERE email = ? AND line_user_id IS NOT NULL").get(email) as { line_user_id: string } | undefined;
  if (linked) await pushLine(linked.line_user_id, `【${siteConfig.auctionName}】ログイン認証コード: ${code}（${OTP_MINUTES}分有効）`).catch(() => {});
  // メール未設定なら画面にコードを表示。公開デモ（DEMO_MODE）では本番でも表示する。
  const showDebug = process.env.DEMO_MODE === "1" || (mailProvider() === "console" && process.env.NODE_ENV !== "production");
  return showDebug ? { debugCode: code } : {};
}

/** 認証コードを検証し、ユーザーを作成/取得してセッションを開始する */
export async function verifyOtp(emailRaw: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normalizeEmail(emailRaw);
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, code_hash, expires_at, attempts FROM otp_codes WHERE email = ? AND consumed = 0 ORDER BY id DESC LIMIT 1",
    )
    .get(email) as { id: number; code_hash: string; expires_at: string; attempts: number } | undefined;
  if (!row) return { ok: false, error: "認証コードを再送信してください。" };
  if (row.expires_at < nowIso()) return { ok: false, error: "認証コードの有効期限が切れました。" };
  if (row.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, error: "試行回数の上限に達しました。再送信してください。" };
  if (row.code_hash !== hashCode(email, code.trim())) {
    db.prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    return { ok: false, error: "認証コードが違います。" };
  }
  db.prepare("UPDATE otp_codes SET consumed = 1 WHERE id = ?").run(row.id);

  const isAdmin = siteConfig.adminEmails.includes(email);
  const role = isAdmin ? "admin" : "user";
  // 管理者は自動承認。承認制オフの場合も登録時点で承認扱い。
  const status = isAdmin || !siteConfig.requireApproval ? "approved" : "pending";
  db.prepare(
    `INSERT INTO users (email, role, status, approved_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       role = CASE WHEN excluded.role = 'admin' THEN 'admin' ELSE users.role END,
       status = CASE WHEN excluded.role = 'admin' AND users.status <> 'blocked' THEN 'approved' ELSE users.status END`,
  ).run(email, role, status, status === "approved" ? nowIso() : null);
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number };
  await createSession(user.id);
  return { ok: true };
}

/** セッションを発行して Cookie に載せる（OTP と LINE ログインで共用） */
export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  getDb().prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expires.toISOString());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires,
    path: "/",
  });
}

export function findUserByLineId(lineUserId: string): User | null {
  return (getDb().prepare("SELECT * FROM users WHERE line_user_id = ?").get(lineUserId) as User | undefined) ?? null;
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const user = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, nowIso()) as User | undefined;
  return user ?? null;
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  jar.delete(SESSION_COOKIE);
}

export function updateProfile(
  userId: number,
  data: { name: string; shipping_name: string; shipping_postal: string; shipping_address: string; shipping_phone: string },
): void {
  getDb()
    .prepare(
      `UPDATE users SET name = ?, shipping_name = ?, shipping_postal = ?, shipping_address = ?, shipping_phone = ? WHERE id = ?`,
    )
    .run(data.name, data.shipping_name, data.shipping_postal, data.shipping_address, data.shipping_phone, userId);
}

export function setLineUserId(userId: number, lineUserId: string | null): void {
  getDb().prepare("UPDATE users SET line_user_id = ? WHERE id = ?").run(lineUserId, userId);
}

export { registerProfile, needsRegistration, canBid, setUserStatus, listMembers } from "./members.ts";
