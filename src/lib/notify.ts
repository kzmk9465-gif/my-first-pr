import { getDb } from "./db.ts";
import { siteConfig } from "./config.ts";
import { sendMail } from "./mail.ts";

export type NotificationType = "outbid" | "won" | "ended_seller" | "new_listing" | "system";

type Target = { id: number; email: string; line_user_id: string | null };

/**
 * 通知を送る。
 * 1. アプリ内通知テーブルに保存（マイページで表示）
 * 2. LINE 連携済みなら LINE Messaging API で push
 * 3. type が won の場合はメールも送る
 */
export async function notifyUser(
  user: Target,
  type: NotificationType,
  message: string,
  listingId?: number,
): Promise<void> {
  const db = getDb();
  db.prepare(
    "INSERT INTO notifications (user_id, type, message, listing_id) VALUES (?, ?, ?, ?)",
  ).run(user.id, type, message, listingId ?? null);

  const url = listingId ? `${siteConfig.baseUrl}/auctions/${listingId}` : siteConfig.baseUrl;

  if (user.line_user_id) {
    await pushLine(user.line_user_id, `${message}\n${url}`).catch((e) =>
      console.error("LINE push failed", e),
    );
  }
  if (type === "won") {
    await sendMail(user.email, `【${siteConfig.auctionName}】落札のお知らせ`, `${message}\n\n${url}`).catch(
      (e) => console.error("mail failed", e),
    );
  }
}

/** LINE Messaging API の push。LINE_CHANNEL_ACCESS_TOKEN が無ければログ出力のみ。 */
export async function pushLine(lineUserId: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.log(`[LINE(dry-run) to ${lineUserId}] ${text}`);
    return;
  }
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text }] }),
  });
  if (!res.ok) throw new Error(`LINE API ${res.status}: ${await res.text()}`);
}
