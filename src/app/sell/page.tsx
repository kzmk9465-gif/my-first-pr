import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sellerContext } from "@/lib/seller-gate";
import { FEE_PLAN_LABELS, siteConfig } from "@/lib/config";

export const metadata: Metadata = { title: "出品者メニュー" };
export const dynamic = "force-dynamic";

export default async function SellIndex() {
  const { user, seller, pinOk } = await sellerContext();
  if (!user) redirect("/login?next=/sell");
  if (seller && pinOk) redirect("/sell/dashboard");
  if (seller) redirect("/sell/pin?next=/sell/dashboard");
  return (
    <div className="max-w-lg mx-auto card p-6 space-y-4">
      <h1 className="text-xl font-black text-accent-2">出品者になるには</h1>
      <p className="text-sm text-muted">{siteConfig.auctionName}では、承認された会員がご自身でオークションに出品できます。出品者登録はお店が行いますので、公式LINEまたはお問い合わせからご連絡ください。</p>
      <div className="text-sm">
        <div className="font-bold mb-1">手数料プラン</div>
        <ul className="space-y-1">
          {siteConfig.feePlans.map((p) => (
            <li key={p.key} className="flex justify-between border-b border-accent/10 py-1"><span>{FEE_PLAN_LABELS[p.key] ?? p.key}</span><span className="text-accent-2 font-bold">{p.rate}%（戻り {100 - p.rate}%）</span></li>
          ))}
        </ul>
      </div>
      <Link href="/mypage" className="btn btn-outline w-full">マイページへ</Link>
    </div>
  );
}
