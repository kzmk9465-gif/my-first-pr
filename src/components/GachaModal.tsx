"use client";

import { useEffect, useRef, useState } from "react";
import type { DrawResult, Rarity } from "@/lib/oripa";

const RANK: Record<Rarity, number> = { S: 4, A: 3, B: 2, C: 1 };
const LABEL: Record<Rarity, string> = { S: "S賞", A: "A賞", B: "B賞", C: "C賞" };
const HUES: Record<Rarity, [string, string]> = {
  S: ["#FFE08A", "#FF6FB0"],
  A: ["#FFD36E", "#FFB347"],
  B: ["#7DF9FF", "#0284C7"],
  C: ["#64748B", "#334155"],
};
const yen = (n: number) => `${n.toLocaleString("ja-JP")} 円`;

type Step = "sealed" | "rising" | "reveal";

type Props = {
  pkgName: string;
  drawCount: number;
  /** 抽選のたびに増える識別子。変わると演出を頭から再生する。 */
  drawId: number;
  results: DrawResult[] | null;
  /** この注文で引ける残りの口数 */
  left: number;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onShip: () => void;
  onAgain: () => void;
};

/**
 * 開封演出。水鏡の球をタップ → 波紋 → 当選カード。
 * 当選品は必ず発送する（ポイント還元・買い戻しのボタンは置かない）。
 */
export default function GachaModal({ pkgName, drawCount, drawId, results, left, busy, error, onClose, onShip, onAgain }: Props) {
  const [step, setStep] = useState<Step>("sealed");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduce = useRef(false);

  useEffect(() => {
    try { reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* ignore */ }
  }, []);

  // 新しい抽選が来たら演出を頭から
  useEffect(() => {
    setStep("sealed");
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [drawId]);

  if (results === null) return null;
  const best = results.reduce<Rarity>((a, r) => (RANK[r.rarity] > RANK[a] ? r.rarity : a), "C");
  const [c1, c2] = HUES[best];
  const rainbow = best === "S";
  const unshipped = results.filter((r) => r.status === "won").length;

  const open = () => {
    if (step !== "sealed") return;
    setStep("rising");
    timer.current = setTimeout(() => setStep("reveal"), reduce.current ? 250 : 1600);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ paddingTop: "max(1rem, env(safe-area-inset-top,0px))", paddingBottom: "max(1rem, env(safe-area-inset-bottom,0px))" }}
      role="dialog" aria-modal="true" aria-label="くじ抽選">
      {/* 水底の背景 */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 30%, #0b1530, #05080f 70%)" }} />
      <button aria-label="閉じる" onClick={onClose}
        className="absolute z-10 h-9 w-9 rounded-full border border-white/15 text-muted hover:text-foreground bg-black/40"
        style={{ top: "max(.75rem, env(safe-area-inset-top,0px))", right: "max(.75rem, env(safe-area-inset-right,0px))" }}>✕</button>

      {/* 中央演出 */}
      <div className="relative w-full max-w-lg text-center">
        {step !== "reveal" ? (
          <button type="button" onClick={open} className="w-full h-[62vh] flex flex-col items-center justify-center select-none" disabled={step === "rising"}>
            {/* 水紋 */}
            {step === "rising" && !reduce.current && [0, 1, 2].map((i) => (
              <span key={i} className="pointer-events-none absolute rounded-full"
                style={{ width: 160, height: 160, border: `2px solid ${c1}`, animation: `oripa-ripple 1.4s ease-out ${i * 0.22}s forwards`, filter: rainbow ? "saturate(1.4)" : "none" }} />
            ))}
            {step === "rising" && rainbow && !reduce.current && (
              <span className="pointer-events-none absolute anim-hue" style={{ width: 260, height: 260, borderRadius: "999px",
                background: "conic-gradient(from 0deg,#ff5f6d,#ffc371,#7DF9FF,#845ec2,#ff5f6d)", opacity: .55, filter: "blur(18px)" }} />
            )}
            {/* 光る水球 */}
            <div className={`relative ${step === "sealed" ? "anim-float" : "anim-rise"}`}>
              <div className={step === "sealed" ? "anim-pulse" : ""} style={{
                width: 150, height: 150, borderRadius: "999px",
                background: rainbow
                  ? "conic-gradient(from 0deg,#ff5f6d,#ffc371,#7DF9FF,#845ec2,#ff5f6d)"
                  : `radial-gradient(circle at 35% 30%, ${c2}, ${c1} 55%, #06121f)`,
                boxShadow: `0 0 60px ${c1}, inset 0 0 40px rgba(255,255,255,.35)`,
                filter: rainbow ? "saturate(1.3)" : "none",
              }} />
              <span className="absolute inset-0 flex items-center justify-center text-4xl font-black" style={{ color: "#05121f" }}>播</span>
            </div>
            <p className="mt-10 text-sm tracking-widest" style={{ color: step === "sealed" ? "var(--accent-2)" : c1 }}>
              {step === "sealed" ? "画面をタップして開封" : rainbow ? "―― 極彩の光。特賞確定 ――" : best === "A" ? "―― 黄金の閃光。激アツ ――" : "―― 光が差し込む ――"}
            </p>
            <p className="mt-1 text-xs text-muted">{pkgName} ・ {drawCount}口</p>
          </button>
        ) : (
          <div className="anim-in">
            <p className="text-xs tracking-[0.3em] text-muted">RESULT</p>
            <h2 className="text-xl font-black mb-3" style={{ color: c1 }}>当選結果</h2>
            <div className={`grid gap-2.5 ${results.length > 1 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 max-w-xs mx-auto"} max-h-[46vh] overflow-y-auto px-0.5 py-1`}>
              {results.map((r, i) => <ResultCard key={r.id} r={r} delay={i * 0.06} single={results.length === 1} />)}
            </div>

            {error && <p className="text-danger text-sm mt-2">{error}</p>}

            <div className="mt-3 grid gap-2">
              {unshipped > 0 ? (
                <button onClick={onShip} disabled={busy} className="btn w-full !py-2.5">🚚 当選品を発送依頼する（{unshipped}点）</button>
              ) : (
                <p className="text-sm text-accent-2 border border-accent/30 rounded-xl p-2">🚚 発送依頼を受け付けました。発送までお待ちください。</p>
              )}
              {left > 0 && <button onClick={onAgain} disabled={busy} className="btn btn-outline w-full !py-2">続けて引く（この注文の残り {left} 口）</button>}
              <button onClick={onClose} className="text-xs text-muted underline mt-0.5">とじる</button>
            </div>
            <p className="mt-2 text-[10px] text-muted">当選品は後からマイページ／播州くじのページでも発送依頼できます（当選から30日以内）。</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ r, delay, single }: { r: DrawResult; delay: number; single: boolean }) {
  const [c1, c2] = HUES[r.rarity];
  const shipped = r.status !== "won";
  return (
    <div className={`anim-reveal rounded-xl border overflow-hidden text-left rank-${r.rarity}`}
      style={{ animationDelay: `${delay}s`, borderColor: r.rarity === "S" || r.rarity === "A" ? c1 : "rgba(255,255,255,.12)", background: "#101726" }}>
      <div className={`relative ${single ? "aspect-[4/3]" : "aspect-square"} flex items-center justify-center overflow-hidden`}
        style={{ background: r.imageUrl ? `url(${r.imageUrl}) center/cover` : `radial-gradient(circle at 40% 30%, ${c2}, ${c1} 70%, #06121f)` }}>
        <span className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(110deg,transparent 30%,rgba(255,255,255,.35) 50%,transparent 70%)", animation: "oripa-sheen 2.4s ease-in-out infinite", animationDelay: `${delay}s` }} />
        {!r.imageUrl && <span className="relative font-black text-white/90" style={{ fontSize: single ? "2rem" : "1.2rem", textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>{LABEL[r.rarity]}</span>}
        <span className="absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full tnum"
          style={{ color: "#05121f", background: c1 }}>{LABEL[r.rarity]}</span>
      </div>
      <div className="p-2">
        <div className={`font-bold leading-snug ${single ? "text-sm" : "text-[11px]"} line-clamp-2`}>{r.name}</div>
        <div className="text-[10px] text-muted mt-0.5">参考価格 <span className="tnum">{yen(r.refPrice)}</span></div>
        {shipped && <div className="text-[10px] mt-0.5 text-accent-2">🚚 発送依頼済み</div>}
      </div>
    </div>
  );
}
