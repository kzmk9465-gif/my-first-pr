import { NextResponse } from "next/server";
import { exchangeCode, lineLoginEnabled, parseState } from "@/lib/line-login";
import { createSession, findUserByLineId, setLineUserId } from "@/lib/auth";
import { siteConfig } from "@/lib/config";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = siteConfig.baseUrl;
  if (!lineLoginEnabled()) return NextResponse.redirect(`${base}/login`);
  const state = parseState(url.searchParams.get("state") ?? "");
  const code = url.searchParams.get("code");
  if (!state || !code) return NextResponse.redirect(`${base}/login?error=${encodeURIComponent("LINEログインに失敗しました。もう一度お試しください。")}`);
  const prof = await exchangeCode(code);
  if (!prof) return NextResponse.redirect(`${base}/login?error=${encodeURIComponent("LINEから情報を取得できませんでした。")}`);

  if (state.link) {
    // ログイン中の会員に LINE を紐づける
    setLineUserId(state.link, prof.userId);
    return NextResponse.redirect(`${base}/mypage?saved=1`);
  }
  const user = findUserByLineId(prof.userId);
  if (!user) {
    return NextResponse.redirect(`${base}/login?error=${encodeURIComponent("このLINEアカウントはまだ連携されていません。メールでログイン後、マイページから連携してください。")}`);
  }
  await createSession(user.id);
  return NextResponse.redirect(`${base}${state.next}`);
}
