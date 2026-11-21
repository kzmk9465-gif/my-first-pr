import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPayment } from "@/lib/payments";
import { getCurrentUser } from "@/lib/auth";
import { siteConfig } from "@/lib/config";
import { yen } from "@/lib/format";
import { completeMockPaymentAction } from "../../actions";

export const metadata: Metadata = { title: "テスト決済" };
export const dynamic = "force-dynamic";

export default async function MockPayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = getPayment(token);
  if (!p) notFound();
  const user = await getCurrentUser();
  if (!user || user.id !== p.buyer_id) redirect(`/login?next=/pay/mock/${token}`);
  if (p.status === "paid") redirect(`/pay/return?token=${token}`);

  return (
    <div className="max-w-md mx-auto card p-6 space-y-4 text-center">
      <div className="text-xs tracking-[0.3em] text-muted">TEST CHECKOUT</div>
      <h1 className="text-xl font-black text-accent-2">テスト決済画面</h1>
      <p className="text-sm text-muted">
        これは決済事業者（Stripe など）の支払い画面の代わりに表示されるテスト用の画面です。
        本番では <code>STRIPE_SECRET_KEY</code> を設定すると、カード・PayPay の実際の決済画面に移ります。
        カード番号は決済事業者の画面で入力され、当サイトのサーバーには届きません。
      </p>
      <div className="text-2xl font-black text-accent-2">{yen(p.amount)}</div>
      <form action={completeMockPaymentAction}>
        <input type="hidden" name="token" value={token} />
        <button className="btn w-full text-lg">支払いを完了する（テスト）</button>
      </form>
      <Link href="/mypage?pay_cancelled=1#orders" className="text-xs text-muted underline">支払わずに戻る</Link>
      <div className="text-[10px] text-muted">{siteConfig.name}</div>
    </div>
  );
}
