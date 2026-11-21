import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { finalizeEnded, getListing } from "@/lib/auctions";
import { canBid, getCurrentUser, needsRegistration } from "@/lib/auth";
import { siteConfig } from "@/lib/config";
import { yen } from "@/lib/format";
import { buyNowAction } from "../actions";

export const metadata: Metadata = { title: "即決の確認" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> };

export default async function BuyoutPage({ params, searchParams }: Props) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/auctions/${id}`);
  if (needsRegistration(user)) redirect(`/register?next=/auctions/${id}`);
  if (!canBid(user)) redirect(`/auctions/${id}?error=${encodeURIComponent("会員承認後に即決できます。")}`);
  await finalizeEnded();
  const l = getListing(id);
  if (!l || !l.buyout_price) notFound();
  const possible = l.status === "open" && l.current_price < l.buyout_price;
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <nav className="text-xs text-muted"><Link href={`/auctions/${id}`} className="hover:text-accent-2">← 出品ページに戻る</Link></nav>
      <div className="card p-5 space-y-4">
        <h1 className="text-xl font-black text-accent-2">即決の確認</h1>
        {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}
        <div className="text-sm"><div className="text-muted">対象</div><div className="font-bold">{l.title}</div><div className="text-xs text-muted">出品 {l.seller_name}</div></div>
        <div>
          <div className="text-sm text-muted">即決価格</div>
          <div className="text-3xl font-black text-accent-2">{yen(l.buyout_price)}</div>
          <div className="text-xs text-muted">＋ 送料 {yen(l.shipping_fee)}（{l.shipping_method === "cool" ? "クール便" : "常温便"}） ＝ お支払い合計 {yen(l.buyout_price + l.shipping_fee)}</div>
          {!possible && <p className="text-danger text-sm mt-1">現在は即決できません。</p>}
        </div>
        <div className="text-xs text-muted space-y-1 border-t border-accent/10 pt-3">
          <p>確定するとオークションは即座に終了し、あなたが落札者になります。<b className="text-foreground">取り消しはできません。</b></p>
          <p>お支払いは{siteConfig.payment.method}、落札後{siteConfig.payment.dueDays}日以内です。発送先はマイページの登録住所になります。</p>
        </div>
        <form action={buyNowAction} className="space-y-3">
          <input type="hidden" name="listing_id" value={id} />
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="agree" className="mt-1" required /><span>内容と<Link href="/legal/terms" className="underline" target="_blank">利用規約</Link>を確認しました。</span></label>
          <button className="btn w-full text-lg" disabled={!possible}>即決で落札する</button>
          <Link href={`/auctions/${id}`} className="btn btn-outline w-full">戻る</Link>
        </form>
      </div>
    </div>
  );
}
