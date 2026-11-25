import { NextResponse } from "next/server";
import { finalizeEnded, liveState } from "@/lib/auctions";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await finalizeEnded();
  const s = liveState(Number(id));
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ...s, now: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
