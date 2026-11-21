import { NextResponse } from "next/server";
import { ticker } from "@/lib/auctions";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ items: ticker() }, { headers: { "Cache-Control": "no-store" } });
}
