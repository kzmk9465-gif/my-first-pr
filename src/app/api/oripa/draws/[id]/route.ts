import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { drawRecord } from "@/lib/oripa";

export const dynamic = "force-dynamic";

/**
 * 演出ページ(/gacha/)が「確定した抽選結果」を読むためのAPI。
 * - 抽選はサーバー(lib/oripa draw)で確定済み。ここは記録を返すだけで、何も決めない。
 * - ログイン中の本人の記録しか返さない(URLのIDを書き換えても他人の記録や別の景品にはならない)。
 * - 演出の等級(SS/S/B/C)は 播州くじの賞(S/A/B/C)から機械的に写す: S賞→SS, A賞→S, B賞→B, C賞→C。
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "ログインしてください。" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return NextResponse.json({ ok: false, error: "IDが正しくありません。" }, { status: 400 });
  const r = drawRecord(user.id, n);
  if (!r) return NextResponse.json({ ok: false, error: "この当選記録は見つかりません。" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ ok: true, ...r }, { headers: { "Cache-Control": "no-store" } });
}
