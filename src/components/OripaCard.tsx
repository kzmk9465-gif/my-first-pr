"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import GachaModal from "./GachaModal";
import { drawOripaAction, redeemOripaAction, shipOripaAction } from "@/app/oripa/actions";
import type { DrawResult } from "@/lib/oripa";

export type PkgLite = {
  id: string; name: string; subtitle: string; pricePt: number; total: number;
  hue: [string, string]; highlights: string[];
};

const pt = (n: number) => `${n.toLocaleString("ja-JP")} pt`;

export default function OripaCard({ pkg, remaining: remaining0, balance: balance0, canDraw, loggedIn }: {
  pkg: PkgLite; remaining: number; balance: number; canDraw: boolean; loggedIn: boolean;
}) {
  const [remaining, setRemaining] = useState(remaining0);
  const [balance, setBalance] = useState(balance0);
  const [results, setResults] = useState<DrawResult[] | null>(null);
  const [drawId, setDrawId] = useState(0);
  const [count, setCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const [c1, c2] = pkg.hue;
  const soldPct = Math.round(((pkg.total - remaining) / pkg.total) * 100);
  const soldOut = remaining <= 0;

  const runDraw = (n: number) => {
    setError(null);
    start(async () => {
      const r = await drawOripaAction(pkg.id, n);
      if (!r.ok) { setError(r.error); return; }
      setResults(r.results); setBalance(r.balance); setRemaining(r.remaining); setCount(n); setDrawId((d) => d + 1);
    });
  };

  const onAgain = () => runDraw(count);

  const onRedeemAgain = () => {
    if (!results) return;
    setError(null);
    const ids = results.filter((x) => x.status === "won").map((x) => x.id);
    start(async () => {
      if (ids.length) { const rr = await redeemOripaAction(ids); if (rr.ok) setBalance(rr.balance); }
      const r = await drawOripaAction(pkg.id, count);
      if (!r.ok) { setError(r.error); return; }
      setResults(r.results); setBalance(r.balance); setRemaining(r.remaining); setDrawId((d) => d + 1);
    });
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

        {/* 目玉（S賞）プレビュー */}
        <div className="flex flex-wrap gap-1.5">
          {pkg.highlights.map((h) => (
            <span key={h} className="inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 border"
              style={{ color: "#05121f", background: "linear-gradient(180deg,#FFE08A,#FFB347)", borderColor: "transparent", fontWeight: 700 }}>
              ★S賞 {h}
            </span>
          ))}
        </div>

        {/* 価格 */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] text-muted">1口</div>
            <div className="tnum text-xl font-bold text-accent-2">{pt(pkg.pricePt)}</div>
          </div>
          <div className="text-right text-[11px] text-muted tnum">残り {remaining} / {pkg.total}口</div>
        </div>

        {/* 残り口数ゲージ */}
        <div className="h-2 rounded-full bg-black/40 overflow-hidden border border-white/5">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.max(2, 100 - soldPct))}%`, background: `linear-gradient(90deg, ${c1}, ${c2})` }} />
        </div>

        {/* ボタン */}
        {!loggedIn ? (
          <Link href="/login?next=/oripa" className="btn w-full mt-1 !py-2 text-sm">ログインして引く</Link>
        ) : !canDraw ? (
          <p className="text-[11px] text-muted border border-white/10 rounded-lg p-2 text-center mt-1">会員承認後にくじを引けます。</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button onClick={() => runDraw(1)} disabled={busy || soldOut} className="btn !py-2 text-sm">1回引く</button>
            <button onClick={() => runDraw(10)} disabled={busy || soldOut || remaining < 10}
              className="rounded-xl py-2 text-sm font-bold border transition disabled:opacity-45"
              style={{ color: "#05121f", background: "linear-gradient(180deg,var(--accent-2),var(--accent) 55%,#0284C7)", borderColor: "transparent", boxShadow: "0 0 15px rgba(0,240,255,.3)" }}>
              10連引く
            </button>
          </div>
        )}
        {error && results === null && <p className="text-danger text-[11px]">{error}</p>}
      </div>

      <GachaModal
        pkgName={pkg.name} pricePt={pkg.pricePt} drawCount={count} drawId={drawId}
        results={results} balance={balance} busy={busy} error={error}
        onClose={() => setResults(null)} onShip={onShip} onRedeemAgain={onRedeemAgain} onAgain={onAgain}
      />
    </article>
  );
}
