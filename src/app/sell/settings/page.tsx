import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sellerContext } from "@/lib/seller-gate";
import { sellerSettingsAction } from "../actions";

export const metadata: Metadata = { title: "出品者設定" };
export const dynamic = "force-dynamic";

export default async function SellerSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const sp = await searchParams;
  const { user, seller, pinOk } = await sellerContext();
  if (!user) redirect("/login?next=/sell/settings");
  if (!seller) redirect("/sell");
  if (!pinOk) redirect("/sell/pin?next=/sell/settings");
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <nav className="text-xs text-muted"><Link href="/sell/dashboard" className="hover:text-accent-2">← 出品者ダッシュボード</Link></nav>
      <h1 className="text-2xl font-black text-accent-2">出品者設定</h1>
      {sp.saved && <p className="text-ok text-sm border border-ok/40 rounded p-2">保存しました。</p>}
      <form action={sellerSettingsAction} className="card p-5 space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">常温便の送料（円）<input name="shipping_normal" type="number" min={0} defaultValue={seller.shipping_normal} className="input mt-1" /></label>
          <label className="block">クール便の送料（円）<input name="shipping_cool" type="number" min={0} defaultValue={seller.shipping_cool} className="input mt-1" /></label>
        </div>
        <label className="block">お支払い案内（落札者に表示。振込先など）<textarea name="payment_info" rows={4} className="input mt-1" defaultValue={seller.payment_info ?? ""} placeholder="例: ○○銀行 ○○支店 普通 1234567 名義 ○○。落札後3日以内にお振込みください。" /></label>
        <label className="block">出品者紹介文<textarea name="description" rows={3} className="input mt-1" defaultValue={seller.description ?? ""} /></label>
        <p className="text-xs text-muted">手数料率（現在 {seller.fee_rate}%）とPINコードの変更はお店にご連絡ください。</p>
        <button className="btn w-full">保存</button>
      </form>
    </div>
  );
}
