import { NextResponse } from "next/server";
import { authorizeUrl, lineLoginEnabled, makeState } from "@/lib/line-login";
import { getCurrentUser } from "@/lib/auth";

/** LINEログイン開始。?link=1 なら現在のログイン会員に LINE を紐づける。 */
export async function GET(req: Request) {
  if (!lineLoginEnabled()) return NextResponse.json({ error: "LINE login is not configured" }, { status: 503 });
  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? "/auctions";
  const link = url.searchParams.get("link") === "1" ? (await getCurrentUser())?.id : undefined;
  return NextResponse.redirect(authorizeUrl(makeState({ next, link })));
}
