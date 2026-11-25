import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { siteConfig } from "@/lib/config";
import { ORDER_EXPIRE_DAYS, getOrder, getPackageById, oripaProvider } from "@/lib/oripa";
import { formatDateTime } from "@/lib/format";
import { mockPayOripaAction } from "../../actions";

export const metadata: Metadata = { title: "くじのお支払い" };
export const dynamic = "force-dynamic";

const yen = (n: number) => `${n.toLocaleString("ja-JP")} 円`;

export default async function OripaOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = getOrder(token);
  if (!order) notFound();
  const user = await getCurrentUser();
  if (!user || user.id !== order.user_id) redirect(`/login?next=${encodeURIComponent(`/oripa/order/${token}`)}`);
  const pkg = getPackageById(order.package_id)!;
  const orderNo = token.slice(-6).toUpperCase();

  if (order.status === "paid") {
    return (
      <div className="max-w-md mx-auto card p-6 space-y-4 text-center">
        <div className="text-4xl">✅</div>
        <h1 className="text-xl font-black text-accent-2">お支払い確認済み</h1>
        <p className="text-sm text-muted">{pkg.name} {order.count}口（{yen(order.amount_yen)}）。引ける口は {order.count - order.drawn} 口です。</p>
        <Link href="/oripa" className="btn w-full">播州くじへ戻って引く</Link>
      </div>
    );
  }
  if (order.status !== "pending") {
    return (
      <div className="max-w-md mx-auto card p-6 space-y-4 text-center">
        <h1 className="text-xl font-black text-accent-2">この注文は無効です</h1>
        <p className="text-sm text-muted">{order.status === "expired" ? `お支払い期限（${ORDER_EXPIRE_DAYS}日）を過ぎたため、注文は無効になりました。` : "この注文は取り消されています。"}改めてご購入ください。</p>
        <Link href="/oripa" className="btn btn-outline w-full">播州くじへ</Link>
      </div>
    );
  }

  const mock = order.provider === "mock" && oripaProvider() === "mock";
  return (
    <div className="max-w-md mx-auto card p-6 space-y-4">
      <div className="text-xs tracking-[0.3em] text-muted">BANSHU KUJI · PAYMENT</div>
      <h1 className="text-xl font-black text-accent-2">くじのお支払い</h1>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-accent/10">
          <tr><th className="text-left text-muted py-2 w-28 font-normal">くじ</th><td className="py-2">{pkg.name}</td></tr>
          <tr><th className="text-left text-muted py-2 font-normal">口数</th><td className="py-2">{order.count}口（1口 {yen(pkg.price_yen)}）</td></tr>
          <tr><th className="text-left text-muted py-2 font-normal">送料</th><td className="py-2 tnum">{order.shipping_yen ? yen(order.shipping_yen) : "無料"}</td></tr>
          <tr><th className="text-left text-muted py-2 font-normal">お支払い金額</th><td className="py-2 text-xl font-black text-accent-2 tnum">{yen(order.amount_yen)}</td></tr>
          <tr><th className="text-left text-muted py-2 font-normal">注文番号</th><td className="py-2 tnum font-bold">{orderNo}</td></tr>
          <tr><th className="text-left text-muted py-2 font-normal">注文日時</th><td className="py-2">{formatDateTime(order.created_at)}</td></tr>
        </tbody>
      </table>

      {mock ? (
        <>
          <p className="text-sm text-muted">お試し環境のため、決済事業者の画面の代わりにテスト決済で進みます。お金は動きません。</p>
          <form action={mockPayOripaAction}>
            <input type="hidden" name="token" value={token} />
            <button className="btn w-full text-lg">支払いを完了する（テスト）</button>
          </form>
        </>
      ) : (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm space-y-2">
          <div className="font-bold text-accent-2">銀行振込でお支払いください</div>
          <p className="whitespace-pre-wrap">{siteConfig.payment.bankInfo}</p>
          <ul className="text-xs text-muted list-disc pl-5 space-y-0.5">
            <li>振込名義の前に注文番号 <b className="text-foreground tnum">{orderNo}</b> を付けてください（例：{orderNo} ハンシュウ タロウ）。</li>
            <li>振込手数料はお客様負担です。</li>
            <li>ご注文から{ORDER_EXPIRE_DAYS}日以内にお振込みください。期限を過ぎると注文は無効になります。</li>
            <li>お店が入金を確認すると、お知らせが届き「播州くじ」のページから引けるようになります（営業日の日中に確認します）。</li>
          </ul>
        </div>
      )}
      <p className="text-[11px] text-muted">購入後の返金・キャンセル、当選品のポイント化・買い取りはできません。18歳未満の方はご購入いただけません。</p>
      <Link href="/oripa" className="text-xs text-muted underline block text-center">播州くじへ戻る</Link>
    </div>
  );
}
