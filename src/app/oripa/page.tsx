import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser, canBid } from "@/lib/auth";
import { CLAIM_DAYS, FREE_SHIPPING_COUNT, ORDER_EXPIRE_DAYS, RARITY_LABEL, SHIPPING_YEN, drawableOrders, myOrders, packageViews, unclaimedWins } from "@/lib/oripa";
import OripaCard, { type PkgLite } from "@/components/OripaCard";
import { formatDateTime } from "@/lib/format";
import { shipAllOripaAction } from "./actions";

export const metadata: Metadata = { title: "播州くじ" };
export const dynamic = "force-dynamic";

const yen = (n: number) => `${n.toLocaleString("ja-JP")} 円`;

export default async function OripaPage({ searchParams }: { searchParams: Promise<{ error?: string; paid?: string; shipped?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const canDraw = !!user && canBid(user);
  const views = packageViews(true);
  const orders = user ? drawableOrders(user.id) : [];
  const pending = user ? myOrders(user.id, 10).filter((o) => o.status === "pending") : [];
  const wins = user ? unclaimedWins(user.id) : [];

  const packages: PkgLite[] = views.map((p) => ({
    id: p.id, slug: p.slug, name: p.name, subtitle: p.subtitle, price_yen: p.price_yen, total: p.total, hue1: p.hue1, hue2: p.hue2,
    prizes: p.prizes.map((x) => ({ id: x.id, rarity: x.rarity, name: x.name, kind: x.kind, ref_price: x.ref_price, count_total: x.count_total, count_left: x.count_left })),
  }));

  return (
    <div className="space-y-6">
      {/* 競市／播州くじ タブ */}
      <div className="flex items-center gap-2">
        <Link href="/auctions" className="flex-1 text-center rounded-xl border border-white/10 bg-[#182234] text-muted py-2.5 font-bold hover:text-foreground transition">競市（オークション）</Link>
        <span className="flex-1 text-center rounded-xl border border-accent/45 bg-accent/15 text-accent-2 py-2.5 font-bold shadow-[0_0_18px_-6px_rgba(0,240,255,.5)]">播州くじ</span>
      </div>

      <header className="rounded-2xl border border-white/10 overflow-hidden relative"
        style={{ background: "radial-gradient(120% 120% at 90% -10%, rgba(0,240,255,.14), transparent 55%), linear-gradient(180deg,#0A1120,#101726)" }}>
        <div className="p-5 sm:p-6">
          <div className="text-[11px] tracking-[0.3em] text-accent-2">BANSHU KUJI · ONLINE KUJI</div>
          <h1 className="text-2xl sm:text-3xl font-black mt-1">播州くじ</h1>
          <p className="text-sm text-muted mt-2 max-w-xl">水鏡の底から、どの生体が引き上がるか。1口から挑めるお店公式のオンラインくじ。全口が賞品付き、当選品はそのままお届けします。</p>
          <p className="text-[11px] text-muted mt-2">18歳以上の会員限定 ・ 口数と各賞の本数は先に決まっています（箱売り） ・ 購入後の返金・ポイント化・買い取りはありません</p>
        </div>
      </header>

      {sp.error && <p className="text-danger text-sm border border-danger/40 rounded-xl p-3">{sp.error}</p>}
      {sp.paid && <p className="text-ok text-sm border border-ok/40 rounded-xl p-3">お支払いを確認しました。下の「引ける口があります」から引いてください。</p>}
      {sp.shipped && <p className="text-ok text-sm border border-ok/40 rounded-xl p-3">発送依頼を受け付けました。</p>}

      {pending.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-[#182234] p-4 text-sm">
          <h2 className="font-bold text-accent-2 mb-1">お支払い待ちの注文</h2>
          <ul className="divide-y divide-white/5">
            {pending.map((o) => (
              <li key={o.token} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <span>{o.package_name} {o.count}口 <span className="tnum text-accent-2 font-bold">{yen(o.amount_yen)}</span><span className="text-xs text-muted ml-2">{formatDateTime(o.created_at)}</span></span>
                <Link href={`/oripa/order/${o.token}`} className="btn btn-outline !py-1 text-xs">お支払い案内</Link>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted mt-1">ご注文から{ORDER_EXPIRE_DAYS}日以内にお支払いがない場合、注文は自動的に無効になります。</p>
        </section>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map((p, i) => (
          <OripaCard key={p.id} pkg={p} remaining={views[i].remaining} sellable={views[i].sellable} loggedIn={!!user} canDraw={canDraw}
            orders={orders.filter((o) => o.package_id === p.id).map((o) => ({ token: o.token, left: o.count - o.drawn }))} />
        ))}
        {packages.length === 0 && <p className="text-muted text-sm">ただいま販売中のくじはありません。</p>}
      </section>

      {wins.length > 0 && (
        <section className="rounded-2xl border border-accent/30 bg-[#182234] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-accent-2">発送依頼がまだの当選品（{wins.length}点）</h2>
            <form action={shipAllOripaAction}>
              <input type="hidden" name="ids" value={wins.map((w) => w.id).join(",")} />
              <button className="btn !py-1.5 text-sm">🚚 まとめて発送依頼する</button>
            </form>
          </div>
          <ul className="divide-y divide-white/5 text-sm mt-2">
            {wins.map((w) => (
              <li key={w.id} className="py-2 flex items-center justify-between gap-2">
                <span><span className="badge badge-star mr-1">{RARITY_LABEL[w.rarity]}</span>{w.prize_name}</span>
                <span className="text-xs text-muted">{formatDateTime(w.created_at)}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted mt-1">当選から{CLAIM_DAYS}日以内に発送依頼をしてください。期限を過ぎた当選品は権利放棄とみなされます（利用規約）。</p>
        </section>
      )}

      <section className="rounded-2xl border border-white/10 bg-[#182234] p-4">
        <h2 className="font-bold text-accent-2 mb-1">遊び方</h2>
        <ol className="text-sm text-muted list-decimal pl-5 space-y-1">
          <li>くじを選んで口数を決め、「口を買う」。お支払い（銀行振込、またはお試し環境ではテスト決済）を済ませます。</li>
          <li>入金の確認後、「引ける口があります」から引けます。水鏡の演出のあと当選品が出ます。</li>
          <li>当選品は<strong className="text-foreground">発送依頼</strong>をすると、お店から発送します（生体は天候と状態を見て原則7日以内）。</li>
        </ol>
        <ul className="text-[11px] text-muted mt-3 space-y-0.5 list-disc pl-5">
          <li>各くじは総口数と各賞の本数が先に決まっていて、引かれた分だけ減ります。残本数は常に表示します。</li>
          <li>全口が賞品付きです。当選品のポイント化・買い取り・他の商品との交換はできません。</li>
          <li>18歳未満の方はご購入いただけません。購入後の返金はできません。</li>
          <li>送料は1回の注文につき{yen(SHIPPING_YEN)}（{FREE_SHIPPING_COUNT}口以上で無料）。口の代金と合わせて1回でお支払いいただきます。</li>
          <li>参考価格は他店のオークション落札価格の目安（中央値・期間・件数は各賞の説明に記載）で、当店の販売価格ではありません。価値を保証するものではありません。</li>
        </ul>
      </section>
    </div>
  );
}
