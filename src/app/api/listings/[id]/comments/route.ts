import { NextResponse } from "next/server";
import { listComments, postComment } from "@/lib/auctions";
import { canBid, getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0) || 0;
  const items = listComments(Number(id), after).map((c) => ({ id: c.id, kind: c.kind, body: c.body, label: c.label, created_at: c.created_at }));
  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  if (!canBid(user)) return NextResponse.json({ error: "承認済み会員のみコメントできます。" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { body?: string };
  const r = postComment(Number(id), user.id, String(body.body ?? ""), user.role === "admin" ? "admin" : "user");
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: r.id });
}
