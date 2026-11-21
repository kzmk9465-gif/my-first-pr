import { createHmac, randomBytes } from "node:crypto";
import { siteConfig } from "./config.ts";

/**
 * LINEログイン（OAuth 2.1）。LINE_LOGIN_CHANNEL_ID / LINE_LOGIN_CHANNEL_SECRET が設定されているときだけ有効。
 * state は HMAC で署名し、コールバックで検証する。
 */
export function lineLoginEnabled(): boolean {
  return !!(process.env.LINE_LOGIN_CHANNEL_ID && process.env.LINE_LOGIN_CHANNEL_SECRET);
}

function secret(): string {
  return process.env.OTP_SALT ?? "banshu-dev-salt";
}

export function makeState(payload: { next: string; link?: number }): string {
  const body = Buffer.from(JSON.stringify({ ...payload, n: randomBytes(8).toString("hex"), t: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function parseState(state: string, maxAgeMs = 10 * 60_000): { next: string; link?: number } | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expect = createHmac("sha256", secret()).update(body).digest("base64url");
  if (sig !== expect) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as { next: string; link?: number; t: number };
    if (Date.now() - p.t > maxAgeMs) return null;
    return { next: p.next.startsWith("/") ? p.next : "/auctions", link: p.link };
  } catch { return null; }
}

export function authorizeUrl(state: string): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINE_LOGIN_CHANNEL_ID ?? "",
    redirect_uri: `${siteConfig.baseUrl}/api/line/callback`,
    state,
    scope: "profile openid",
  });
  return `https://access.line.me/oauth2/v2.1/authorize?${p.toString()}`;
}

/** 認可コードをトークンに交換し、LINEのユーザーIDと表示名を返す */
export async function exchangeCode(code: string): Promise<{ userId: string; displayName: string } | null> {
  const res = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${siteConfig.baseUrl}/api/line/callback`,
      client_id: process.env.LINE_LOGIN_CHANNEL_ID ?? "",
      client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET ?? "",
    }),
  });
  if (!res.ok) return null;
  const tok = (await res.json()) as { access_token: string };
  const prof = await fetch("https://api.line.me/v2/profile", { headers: { Authorization: `Bearer ${tok.access_token}` } });
  if (!prof.ok) return null;
  const p = (await prof.json()) as { userId: string; displayName: string };
  return { userId: p.userId, displayName: p.displayName };
}
