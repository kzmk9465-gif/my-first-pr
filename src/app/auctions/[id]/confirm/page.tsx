import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { bidStatus, finalizeEnded, getListing, minimumBid } from "@/lib/auctions";
import { canBid, getCurrentUser, needsRegistration } from "@/lib/auth";
import { siteConfig } from "@/lib/config";
import { formatDateTime, yen } from "@/lib/format";
import { bidAction } from "../actions";

export const metadata: Metadata = { title: "入札内容の確認" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ amount?: string; error?: string }> };

export default async function ConfirmPage({ params, searchParams }: Props) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/auctions/${id}`);
  if (needsRegistration(user)) redirect(`/register?next=/auctions/${id}`);
  if (!canBid(user)) redirect(`/auctions/${id}?error=${encodeURIComponent("会員承認後に入札できます。")}`);
  await finalizeEnded();
  const l = getListing(id);
  if (!l) notFound();
  const amount = Number(sp.amount);
  if (!Number.isInteger(amount) || amount <= 0) redirect(`/auctions/${id}`);
  const st = bidStatus(id, user.id);
  const iAmTop = st.leader_id === user.id;
  const min = iAmTop ? (st.my_max ?? 0) + 1 : minimumBid(l);
  const tooLow = amount < min;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <nav className="text-xs text-muted"><Link href={`/auctions/${id}`} className="hover:text-accent-2">← 出品ページに戻る</Link></nav>
      <div className="card p-5 space-y-4">
        <h1 className="text-xl font-black text-accent-2">入札内容の確認</h1>
        {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}
        <div className="text-sm">
          <div className="text-muted">対象</div>
          <div className="font-bold">{l.title}</div>
          <div className="text-xs text-muted">出品 {l.seller_name} ／ 終了 {formatDateTime(l.ends_at)} ／ 現在価格 {yen(l.current_price)}</div>
        </div>
        <div>
          <div className="text-sm text-muted">あなたの上限額</div>
          <div className="text-3xl font-black text-accent-2">{yen(amount)}</div>
          {tooLow && <p className="text-danger text-sm mt-1">{yen(min)} 以上で入札してください。</p>}
        </div>
        <div className="text-xs text-muted space-y-1 border-t border-accent/10 pt-3">
          <p><b className="text-foreground">この金額はお支払い額ではなく「ここまでなら出せる」上限です。</b>実際の価格は他の方の入札状況によって決まり、上限額を超えることはありません。</p>
          <p>他の方の上限に届かなかった場合はその場で競り負けとなり、価格があなたの上限まで上がります（競り負け履歴はマイページで確認できます）。</p>
          <p>終了{Math.round(siteConfig.autoExtendWindowSeconds / 60)}分以内の入札で終了時刻が延長されます{l.sudden_death ? "（サドンデス：延長は回数ごとに短くなります）" : ""}。</p>
          <p>オークション終了時点で最高額入札者となった場合、出品者との間で売買契約が成立します。お支払いは{siteConfig.payment.method}、落札後{siteConfig.payment.dueDays}日以内です。</p>
        </div>
        <form action={bidAction} className="space-y-3">
          <input type="hidden" name="listing_id" value={id} />
          <input type="hidden" name="amount" value={amount} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="agree" className="mt-1" required />
            <span>入札内容・契約成立時期・キャンセル不可の条件・<Link href="/legal/terms" className="underline" target="_blank">利用規約</Link>を確認しました。<b>確定後の取り消しはできません。</b></span>
          </label>
          <button className="btn w-full text-lg" disabled={tooLow}>上記内容で入札を確定する</button>
          <Link href={`/auctions/${id}`} className="btn btn-outline w-full">戻って金額を修正する</Link>
        </form>
      </div>
    </div>
  );
}
