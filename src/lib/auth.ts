import { cookies } from "next/headers";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { getDb, nowIso } from "./db.ts";
import { siteConfig } from "./config.ts";
import { mailProvider, sendMail } from "./mail.ts";

export type User = {
  id: number;
  email: string;
  name: string | null;
  role: "user" | "admin";
  line_user_id: string | null;
  shipping_name: string | null;
  shipping_postal: string | null;
  shipping_address: string | null;
  shipping_phone: string | null;
  created_at: string;
};

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
  const showDebug = mailProvider() === "console" && process.env.NODE_ENV !== "production";
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

  const role = siteConfig.adminEmails.includes(email) ? "admin" : "user";
  db.prepare(
    "INSERT INTO users (email, role) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET role = CASE WHEN excluded.role = 'admin' THEN 'admin' ELSE users.role END",
  ).run(email, role);
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number };

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
    token,
    user.id,
    expires.toISOString(),
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires,
    path: "/",
  });
  return { ok: true };
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
