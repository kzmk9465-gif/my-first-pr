import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

type LineEvent = { type: string; replyToken?: string; source?: { userId?: string }; message?: { type: string; text?: string } };

/**
 * LINE Messaging API の Webhook。
 * 友だち追加時、または「連携」と送信された時に、ユーザーIDを連携コードとして返信する。
 * ユーザーはマイページでそのコードを登録すると通知を受け取れる。
 */
export async function POST(req: Request) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const body = await req.text();
  if (!secret || !token) return NextResponse.json({ error: "LINE not configured" }, { status: 503 });

  const sig = req.headers.get("x-line-signature") ?? "";
  const expected = createHmac("sha256", secret).update(body).digest("base64");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  const { events = [] } = JSON.parse(body) as { events: LineEvent[] };
  for (const ev of events) {
    const uid = ev.source?.userId;
    if (!uid || !ev.replyToken) continue;
    const wantsCode = ev.type === "follow" || (ev.type === "message" && ev.message?.type === "text" && /連携|れんけい|code/i.test(ev.message.text ?? ""));
    if (!wantsCode) continue;
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        replyToken: ev.replyToken,
        messages: [
          { type: "text", text: "友だち追加ありがとうございます。以下の連携コードをマイページの「LINE通知の設定」に貼り付けてください。" },
          { type: "text", text: uid },
        ],
      }),
    }).catch((e) => console.error("LINE reply failed", e));
  }
  return NextResponse.json({ ok: true });
}
