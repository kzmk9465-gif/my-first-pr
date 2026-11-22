import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser, canBid } from "@/lib/auth";
import { points } from "@/lib/gacha";
import { PACKAGES, remaining, myWins, RARITY_LABEL } from "@/lib/oripa";
import OripaCard, { type PkgLite } from "@/components/OripaCard";

export const metadata: Metadata = { title: "播州くじ" };
export const dynamic = "force-dynamic";

const pt = (n: number) => `${n.toLocaleString("ja-JP")} pt`;
const yen = (n: number) => `${n.toLocaleString("ja-JP")} 円`;

export default async function OripaPage() {
  const user = await getCurrentUser();
  const balance = user ? points(user.id) : 0;
  const canDraw = !!user && canBid(user);
  const wins = user ? myWins(user.id, 12) : [];

  const packages: (PkgLite & { remaining: number })[] = PACKAGES.map((p) => ({
    id: p.id, name: p.name, subtitle: p.subtitle, pricePt: p.pricePt, total: p.total,
    hue: p.hue, highlights: p.highlights, remaining: remaining(p.id),
  }));

  return (
    <div className="space-y-6">
      {/* 競市／播州くじ タブ */}
      <div className="flex items-center gap-2">
        <Link href="/auctions" className="flex-1 text-center rounded-xl border border-white/10 bg-[#182234] text-muted py-2.5 font-bold hover:text-foreground transition">競市（オークション）</Link>
        <span className="flex-1 text-center rounded-xl border border-accent/45 bg-accent/15 text-accent-2 py-2.5 font-bold shadow-[0_0_18px_-6px_rgba(0,240,255,.5)]">播州くじ（オリパ）</span>
      </div>

      <header className="rounded-2xl border border-white/10 overflow-hidden relative"
        style={{ background: "radial-gradient(120% 120% at 90% -10%, rgba(0,240,255,.14), transparent 55%), linear-gradient(180deg,#0A1120,#101726)" }}>
        <div className="p-5 sm:p-6">
          <div className="text-[11px] tracking-[0.3em] text-accent-2">BANSHU KUJI · ONLINE ORIPA</div>
          <h1 className="text-2xl sm:text-3xl font-black mt-1">播州くじ</h1>
          <p className="text-sm text-muted mt-2 max-w-xl">水鏡の底から、どの生体が引き上がるか。1口から挑める公式オンラインくじ。当たった個体はそのまま発送依頼も、ポイント還元して引き直しも自由です。</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted">所持ポイント <b className="tnum text-accent-2 text-lg">{pt(balance)}</b></span>
            {user && <Link href="/mypage" className="text-xs text-muted underline">履歴・発送先</Link>}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map((p) => (
          <OripaCard key={p.id} pkg={p} remaining={p.remaining} balance={balance} canDraw={canDraw} loggedIn={!!user} />
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#182234] p-4">
        <h2 className="font-bold text-accent-2 mb-1">遊び方</h2>
        <ol className="text-sm text-muted list-decimal pl-5 space-y-1">
          <li>ヘッダー右の「＋チャージ」でポイントを用意（現在はテストチャージ）。</li>
          <li>くじを選んで「1回引く」または「10連引く」。水鏡の演出のあと当選個体が出ます。</li>
          <li>当たった生体は<strong className="text-foreground">発送依頼</strong>するか、<strong className="text-foreground">ポイント還元</strong>してもう一度引けます。</li>
        </ol>
      </section>

      {wins.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-[#182234] p-4">
          <h2 className="font-bold text-accent-2 mb-2">当選した生体（最新{wins.length}件）</h2>
          <ul className="divide-y divide-white/5 text-sm">
            {wins.map((w) => (
              <li key={w.id} className="py-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full tnum rank-${w.rarity}`}
                    style={{ color: "#05121f", background: w.rarity === "S" ? "#FFE08A" : w.rarity === "A" ? "#FFD36E" : w.rarity === "B" ? "#7DF9FF" : "#94A3B8" }}>{RARITY_LABEL[w.rarity]}</span>
                  <span className="truncate">{w.prize_name}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0 text-xs">
                  <span className="text-muted tnum">{yen(w.ref_price)}</span>
                  {w.status === "redeemed" ? <span className="badge" style={{ color: "#FFD36E" }}>還元済み</span>
                    : w.status === "ship_requested" ? <span className="badge badge-ok">発送依頼済み</span>
                    : <span className="badge badge-star">当選</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
