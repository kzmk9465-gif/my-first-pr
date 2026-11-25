import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { siteConfig } from "@/lib/config";
import { requestCodeAction, verifyCodeAction } from "./actions";
import { lineLoginEnabled } from "@/lib/line-login";

export const metadata: Metadata = { title: "ログイン" };
export const dynamic = "force-dynamic";

type Search = { step?: string; email?: string; next?: string; error?: string; debug?: string };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect(sp.next && sp.next.startsWith("/") ? sp.next : "/auctions");
  const next = sp.next ?? "/auctions";

  return (
    <div className="max-w-md mx-auto card p-6 space-y-4">
      <h1 className="text-xl font-black text-accent-2 text-center">{siteConfig.auctionName} ログイン</h1>
      {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}

      {sp.step === "code" ? (
        <form action={verifyCodeAction} className="space-y-3">
          <input type="hidden" name="email" value={sp.email ?? ""} />
          <input type="hidden" name="next" value={next} />
          <p className="text-sm text-muted">
            <b className="text-foreground">{sp.email}</b> に認証コードを送信しました。メールに届いた6桁の数字を入力してください。
          </p>
          {sp.debug && (
            <p className="text-xs text-ok border border-ok/40 rounded p-2">
              お試し環境：メール送信が未設定のため、ここに認証コードを表示しています → <b className="text-base tracking-widest">{sp.debug}</b><br />この数字をそのまま下の欄に入力してください。
            </p>
          )}
          <input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="123456" required autoFocus className="input text-center text-2xl tracking-[0.5em]" />
          <button className="btn w-full">認証してログイン</button>
          <a href={`/login?next=${encodeURIComponent(next)}`} className="block text-center text-xs text-muted underline">戻る</a>
        </form>
      ) : (
        <form action={requestCodeAction} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <p className="text-sm text-muted">登録メールアドレスを入力してください。認証コードを送信します。未登録の方も同じ手順で会員登録できます。</p>
          <input name="email" type="email" placeholder="例: yamada@example.com" required autoFocus className="input" defaultValue={sp.email ?? ""} />
          <button className="btn w-full">認証コードを送信</button>
          {lineLoginEnabled() && <a href={`/api/line/login?next=${encodeURIComponent(next)}`} className="btn btn-line w-full">LINEでログイン（連携済みの方）</a>}
          <p className="text-xs text-muted">ログインすることで<Link href="/legal/terms" className="underline">利用規約</Link>と<Link href="/legal/privacy" className="underline">プライバシーポリシー</Link>に同意したものとみなします。</p>
        </form>
      )}
    </div>
  );
}
