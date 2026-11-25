import { NextResponse } from "next/server";
import { finalizeEnded } from "@/lib/auctions";

/**
 * 終了処理を外部のスケジューラから叩くためのエンドポイント。
 * 画面アクセス時にも遅延実行されるため必須ではないが、
 * アクセスが無い時間帯でも落札通知を即時に送りたい場合に使う。
 * 例: curl -H "Authorization: Bearer $CRON_SECRET" https://example.com/api/cron/finalize
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const finalized = await finalizeEnded();
  return NextResponse.json({ ok: true, finalized });
}
