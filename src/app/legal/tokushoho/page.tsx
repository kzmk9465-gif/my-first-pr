import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = { title: "特定商取引法に基づく表記" };

export default function TokushohoPage() {
  const L = siteConfig.legal;
  const rows: [string, string][] = [
    ["販売業者", L.businessName],
    ["運営責任者", L.representative],
    ["所在地", L.address],
    ["電話番号", L.phone],
    ["メールアドレス", L.email],
    ["販売価格", "各オークションの落札価格（消費税込み）"],
    ["商品代金以外の必要料金", L.shippingFee + " 銀行振込の場合の振込手数料はお客様負担です。"],
    ["支払方法", siteConfig.payment.method],
    ["支払時期", `落札後${siteConfig.payment.dueDays}日以内`],
    ["商品の引渡時期", "入金確認後、天候と生体の状態を考慮し原則7日以内に発送します。"],
    ["返品・キャンセル", "生体のため、お客様都合による返品・キャンセルはお受けできません。死着保証の有無と条件は各出品の説明欄に記載します。"],
  ];
  return (
    <article className="max-w-2xl mx-auto card p-6 space-y-4 text-sm">
      <h1 className="text-2xl font-black text-accent-2">特定商取引法に基づく表記</h1>
      <table className="w-full">
        <tbody className="divide-y divide-accent/10">
          {rows.map(([k, v]) => (
            <tr key={k}><th className="text-left text-muted py-2 pr-4 align-top w-40 font-normal">{k}</th><td className="py-2">{v}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted">※ 所在地・電話番号などは環境変数（LEGAL_*）で設定します。</p>
    </article>
  );
}
