"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import GachaModal from "./GachaModal";
import { buyOripaAction, drawOripaAction, shipOripaAction } from "@/app/oripa/actions";
import type { DrawResult, Rarity } from "@/lib/oripa";
import { FREE_SHIPPING_COUNT, SHIPPING_YEN, shippingFor } from "@/lib/oripa-shipping";

export type PrizeLite = { id: number; rarity: Rarity; name: string; kind: string; ref_price: number; ref_note?: string; count_total: number; count_left: number };
export type PkgLite = {
  id: number; slug: string; name: string; subtitle: string; price_yen: number; total: number;
  hue1: string; hue2: string; prizes: PrizeLite[];
};
export type OrderLite = { token: string; left: number };

const yen = (n: number) => `${n.toLocaleString("ja-JP")} 円`;
const LABEL: Record<Rarity, string> = { S: "S賞", A: "A賞", B: "B賞", C: "C賞" };
const COLOR: Record<Rarity, string> = { S: "#FFE08A", A: "#FFD36E", B: "#7DF9FF", C: "#94A3B8" };

export default function OripaCard({ pkg, remaining: remaining0, sellable, loggedIn, canDraw, orders: orders0 }: {
  pkg: PkgLite; remaining: number; sellable: boolean; loggedIn: boolean; canDraw: boolean; orders: OrderLite[];
}) {
  const [remaining, setRemaining] = useState(remaining0);
  const [orders, setOrders] = useState(orders0);
  const [prizes, setPrizes] = useState(pkg.prizes);
  const [results, setResults] = useState<DrawResult[] | null>(null);
  const [drawId, setDrawId] = useState(0);
  const [count, setCount] = useState(1);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const c1 = pkg.hue1, c2 = pkg.hue2;
  const soldPct = pkg.total > 0 ? Math.round(((pkg.total - remaining) / pkg.total) * 100) : 100;
  const soldOut = remaining <= 0;
  const prizeLeft = prizes.reduce((a, p) => a + p.count_left, 0);

  const runDraw = (token: string, n: number) => {
    setError(null);
    start(async () => {
      const r = await drawOripaAction(token, n);
      if (!r.ok) { setError(r.error); return; }
      setResults(r.results); setRemaining(r.remaining); setCount(n); setActive(token); setDrawId((d) => d + 1);
      setOrders((prev) => prev.map((o) => (o.token === token ? { ...o, left: r.left } : o)).filter((o) => o.left > 0));
      // 各賞の残本数を画面側でも減らす
      setPrizes((prev) => prev.map((p) => ({ ...p, count_left: p.count_left - r.results.filter((x) => x.name === p.name && x.rarity === p.rarity).length })));
    });
  };

  const onAgain = () => {
    if (!active) return;
    const o = orders.find((x) => x.token === active);
    if (!o) return;
    runDraw(active, Math.min(count, o.left));
  };

  const onShip = () => {
    if (!results) return;
    setError(null);
    const ids = results.filter((x) => x.status === "won").map((x) => x.id);
    start(async () => {
      const r = await shipOripaAction(ids);
      if (!r.ok) { setError(r.error); return; }
      setResults((prev) => prev && prev.map((x) => (ids.includes(x.id) ? { ...x, status: "ship_requested" } : x)));
    });
  };

  const activeLeft = active ? orders.find((o) => o.token === active)?.left ?? 0 : 0;

  return (
    <article className="rounded-2xl border border-white/10 bg-[#182234] overflow-hidden flex flex-col">
      {/* バナー */}
      <div className="relative aspect-[16/7] flex items-center justify-center overflow-hidden"
        style={{ background: `radial-gradient(120% 120% at 15% 10%, ${c2}, ${c1} 60%, #06121f)` }}>
        <span className="pointer-events-none absolute inset-0 opacity-70"
          style={{ background: "radial-gradient(60% 80% at 80% 120%, rgba(255,255,255,.25), transparent 60%)" }} />
        <div className="relative text-center px-3">
          <div className="text-[11px] tracking-[0.25em] text-white/80">BANSHU KUJI</div>
          <div className="text-lg sm:text-xl font-black text-white drop-shadow-[0_2px_10px_rgba(0,0,0,.5)]">{pkg.name}</div>
        </div>
        {soldOut && <span className="absolute inset-0 bg-black/60 flex items-center justify-center text-lg font-black text-white">完売</span>}
      </div>

      <div className="p-3.5 flex flex-col gap-2.5 flex-1">
        <p className="text-xs text-muted">{pkg.subtitle}</p>

        {/* 価格と残り */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] text-muted">1口（税込）・送料 {yen(SHIPPING_YEN)}／1回の注文（{FREE_SHIPPING_COUNT}口以上で無料）</div>
            <div className="tnum text-xl font-bold text-accent-2">{yen(pkg.price_yen)}</div>
          </div>
          <div className="text-right text-[11px] text-muted tnum">残り {remaining} / {pkg.total}口</div>
        </div>
        <div className="h-2 rounded-full bg-black/40 overflow-hidden border border-white/5">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.max(2, 100 - soldPct))}%`, background: `linear-gradient(90deg, ${c1}, ${c2})` }} />
        </div>

        {/* 箱の中身（各賞の残本数＝確率の根拠） */}
        <table className="w-full text-[11px]">
          <tbody>
            {prizes.map((p) => (
              <tr key={p.id} className="border-t border-white/5">
                <td className="py-1 pr-1 whitespace-nowrap font-bold" style={{ color: COLOR[p.rarity] }}>{LABEL[p.rarity]}</td>
                <td className="py-1 pr-1">{p.name}<span className="text-muted"> ・参考 {yen(p.ref_price)}{p.ref_note ? `（${p.ref_note}）` : ""}</span></td>
                <td className="py-1 text-right tnum whitespace-nowrap text-muted">残 {p.count_left}/{p.count_total}本</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[10px] text-muted">当たる確率＝その賞の残本数 ÷ 残り口数（残 {prizeLeft} 本）。全口が賞品付き（はずれ無し）。当選品は発送でお届けします。</p>

        {/* 引ける口（入金済み） */}
        {orders.length > 0 && (
          <div className="rounded-xl border border-accent/40 bg-accent/10 p-2.5 space-y-1.5">
            <div className="text-xs font-bold text-accent-2">引ける口があります</div>
            {orders.map((o) => (
              <div key={o.token} className="flex items-center justify-between gap-2 text-xs">
                <span className="tnum">残り {o.left} 口</span>
                <span className="flex gap-1.5">
                  <button onClick={() => runDraw(o.token, 1)} disabled={busy} className="btn !py-1 !px-3 text-xs">1口引く</button>
                  {o.left > 1 && <button onClick={() => runDraw(o.token, Math.min(10, o.left))} disabled={busy} className="btn !py-1 !px-3 text-xs">まとめて{Math.min(10, o.left)}口</button>}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 購入 */}
        {!loggedIn ? (
          <Link href="/login?next=/oripa" className="btn w-full mt-1 !py-2 text-sm">ログインして買う</Link>
        ) : !canDraw ? (
          <p className="text-[11px] text-muted border border-white/10 rounded-lg p-2 text-center mt-1">会員承認後にくじを購入できます。</p>
        ) : !sellable || soldOut ? (
          <p className="text-[11px] text-muted border border-white/10 rounded-lg p-2 text-center mt-1">{soldOut ? "完売しました。" : "準備中です。"}</p>
        ) : (
          <form action={buyOripaAction} className="grid grid-cols-[1fr_auto] gap-2 mt-1 items-center">
            <input type="hidden" name="slug" value={pkg.slug} />
            <select name="count" defaultValue={1} className="input !py-2 text-sm" aria-label="口数">
              {Array.from({ length: Math.min(10, remaining) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}口（{yen(pkg.price_yen * n + shippingFor(n))}{shippingFor(n) ? " 送料込" : " 送料無料"}）</option>
              ))}
            </select>
            <button className="btn !py-2 text-sm">口を買う</button>
          </form>
        )}
        {error && results === null && <p className="text-danger text-[11px]">{error}</p>}
      </div>

      <GachaModal
        pkgName={pkg.name} drawCount={count} drawId={drawId}
        results={results} left={activeLeft} busy={busy} error={error}
        onClose={() => setResults(null)} onShip={onShip} onAgain={onAgain}
      />
    </article>
  );
}
