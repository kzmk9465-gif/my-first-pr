import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** 死活監視用。DBに触れて疎通も確認する。 */
export async function GET() {
  try {
    getDb().prepare("SELECT 1").get();
    return NextResponse.json({ ok: true, time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
