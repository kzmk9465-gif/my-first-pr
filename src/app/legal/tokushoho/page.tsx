import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";
import { FREE_SHIPPING_COUNT, SHIPPING_YEN } from "@/lib/oripa-shipping";

export const metadata: Metadata = { title: "特定商取引法に基づく表記" };

export default function TokushohoPage() {
  const L = siteConfig.legal;
  const rows: [string, string][] = [
    ["販売業者", L.businessName],
    ["運営責任者", L.representative],
    ["所在地", L.address],
    ["電話番号", L.phone],
    ["メールアドレス", L.email],
    ["お問い合わせ窓口", siteConfig.line.addFriendUrl ? siteConfig.name + "の公式LINE（" + siteConfig.line.addFriendUrl + "）またはメール" : siteConfig.name + "の公式LINEまたはメール"],
    ["販売価格", "オークション：各出品の落札価格（消費税込み）。播州くじ：各くじの1口の価格（消費税込み）に口数を掛けた金額"],
    ["商品代金以外の必要料金", L.shippingFee + " 銀行振込の場合の振込手数料はお客様負担です。播州くじ：1回のご注文につき送料" + SHIPPING_YEN.toLocaleString("ja-JP") + "円（" + FREE_SHIPPING_COUNT + "口以上のご注文は無料）。送料は口の代金と合わせてお支払いいただきます。"],
    ["支払方法", `${siteConfig.payment.method}。オンライン決済に対応する場合は外部の決済代行事業者の画面で行われ、当方はカード番号等を保持しません。`],
    ["支払時期", `オークション：落札後${siteConfig.payment.dueDays}日以内。播州くじ：ご注文から3日以内（期限を過ぎた注文は無効になります）`],
    ["商品の引渡時期", "入金確認後、天候と生体の状態を考慮し原則7日以内に発送します。播州くじの当選品は、発送依頼をいただいてから同様に発送します。"],
    ["返品・キャンセル", "生体のため、お客様都合による返品・キャンセルはお受けできません。死着保証の有無と条件は各出品の説明欄に記載します。播州くじは、くじの性質上、購入後の返金・キャンセルはお受けできません。"],
    ["播州くじについて", "総口数と各賞の本数を事前に定めた箱売りのくじです。全口に賞品が付き、当選品は発送でお渡しします。当選品を現金・ポイント・他の商品に換えることはできません。18歳未満の方はご購入いただけません。当選から30日以内に発送依頼がない場合は権利放棄とみなします。表示する参考価格は当店の通常販売価格または市場の目安であり、保証するものではありません。"],
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
