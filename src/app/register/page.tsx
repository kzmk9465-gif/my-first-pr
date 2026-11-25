import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { siteConfig } from "@/lib/config";
import { registerAction } from "./actions";

export const metadata: Metadata = { title: "会員登録" };
export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/auctions";
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/register?next=${next}`)}`);

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="card p-5 space-y-4">
        <h1 className="text-xl font-black text-accent-2">会員登録</h1>
        <p className="text-sm text-muted">
          入札には会員登録が必要です。{siteConfig.requireApproval && "ご入力後、お店が内容（SNSなど）を確認して承認します。承認されるとお知らせが届きます。"}
          住所は落札時の送り先になります。
        </p>
        {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}
        <form action={registerAction} className="space-y-3 text-sm">
          <input type="hidden" name="next" value={next} />
          <div className="text-xs text-muted">メールアドレス：{user.email}</div>
          <label className="block">氏名 *<input name="name" required className="input mt-1" defaultValue={user.name ?? ""} placeholder="播州 太郎" /></label>
          <label className="block">屋号（ブリーダー名・任意）<input name="shop_name" className="input mt-1" defaultValue={user.shop_name ?? ""} placeholder="例: ○○めだか" /></label>
          <label className="block">Instagram などのSNSアカウント（任意・承認の確認に使います）<input name="instagram" className="input mt-1" defaultValue={user.instagram ?? ""} placeholder="@your_account" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">郵便番号 *<input name="shipping_postal" required className="input mt-1" defaultValue={user.shipping_postal ?? ""} placeholder="670-0000" /></label>
            <label className="block">電話番号 *<input name="shipping_phone" required className="input mt-1" defaultValue={user.shipping_phone ?? ""} placeholder="079-000-0000" /></label>
          </div>
          <label className="block">住所 *<input name="shipping_address" required className="input mt-1" defaultValue={user.shipping_address ?? ""} placeholder="兵庫県姫路市…" /></label>
          <label className="block">生年月日 *<input name="birthdate" type="date" required className="input mt-1" defaultValue={user.birthdate ?? ""} max={new Date().toISOString().slice(0, 10)} />
            <span className="block text-xs text-muted mt-1">播州くじ（オンラインくじ）は18歳以上の方のみご利用いただけます。年齢の確認に使います。</span></label>
          <label className="block">宛名（氏名と異なる場合）<input name="shipping_name" className="input mt-1" defaultValue={user.shipping_name ?? ""} /></label>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="agree" className="mt-1" required />
            <span><Link href="/legal/terms" className="underline" target="_blank">利用規約</Link>と<Link href="/legal/privacy" className="underline" target="_blank">プライバシーポリシー</Link>に同意します。</span>
          </label>
          <button className="btn w-full">登録する</button>
        </form>
      </div>
    </div>
  );
}
