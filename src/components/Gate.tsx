"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const HOLD_MS = 1500;

/**
 * 入場ゲート。円を長押しするとゲージが満ちて会場へ転送する。
 * 長押しは pointer イベントで判定し、途中で離すとゲージが戻る。
 */
export default function Gate({ name, target }: { name: string; target: string }) {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [warping, setWarping] = useState(false);
  const holdingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    router.prefetch(target);
  }, [router, target]);

  const tick = useCallback(() => {
    if (!holdingRef.current) return;
    const p = Math.min(1, (performance.now() - startRef.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      holdingRef.current = false;
      setWarping(true);
      setTimeout(() => router.push(target), 700);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [router, target]);

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    if (warping) return;
    holdingRef.current = true;
    startRef.current = performance.now() - progress * HOLD_MS;
    rafRef.current = requestAnimationFrame(tick);
  };

  const stop = () => {
    holdingRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (!warping) {
      // ゆっくり戻す
      const decay = () => {
        setProgress((p) => {
          const n = Math.max(0, p - 0.04);
          if (n > 0 && !holdingRef.current) requestAnimationFrame(decay);
          return n;
        });
      };
      requestAnimationFrame(decay);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center select-none transition-opacity duration-700 ${warping ? "bg-white" : "bg-background"}`}
      style={{
        backgroundImage: warping
          ? undefined
          : "radial-gradient(circle at 50% 40%, rgba(0,240,255,.18), transparent 55%), radial-gradient(circle at 20% 80%, rgba(80,120,255,.12), transparent 40%)",
      }}
    >
      <Stars />
      <div className={`text-center transition-all duration-500 ${warping ? "opacity-0 scale-150" : "opacity-100"}`}>
        <div className="text-xs tracking-[0.5em] text-muted">PREMIUM AUCTION</div>
        <h1 className="mt-2 text-6xl sm:text-7xl font-black text-accent-2 tracking-widest drop-shadow-[0_0_30px_rgba(0,240,255,.45)]">
          播州
        </h1>
        <div className="mt-1 text-sm text-muted">{name}</div>
      </div>

      <div className={`mt-14 flex flex-col items-center gap-5 transition-all duration-500 ${warping ? "opacity-0 scale-150" : ""}`}>
        <p className="text-sm text-muted">この円を長押しして、会場へ入場せよ</p>
        <button
          type="button"
          aria-label="長押しして入場"
          onPointerDown={start}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onContextMenu={(e) => e.preventDefault()}
          className="relative h-40 w-40 rounded-full touch-none"
        >
          <span className="absolute inset-0 rounded-full border border-accent/30 animate-[spin_12s_linear_infinite]" style={{ borderStyle: "dashed" }} />
          <span className="absolute inset-3 rounded-full border border-accent/50" />
          <span
            className="absolute inset-6 rounded-full overflow-hidden bg-surface"
            style={{ boxShadow: `0 0 ${20 + progress * 60}px rgba(0,240,255,${0.25 + progress * 0.6})` }}
          >
            <span
              className="absolute left-0 right-0 bottom-0 bg-accent transition-[height] duration-75"
              style={{ height: `${progress * 100}%` }}
            />
          </span>
          <span className="absolute inset-0 flex flex-col items-center justify-center font-black">
            <span className={`text-2xl ${progress > 0.5 ? "text-[#042430]" : "text-accent-2"}`}>{warping ? "転送" : "入場"}</span>
            <span className={`text-[10px] tracking-[0.4em] ${progress > 0.7 ? "text-[#042430]" : "text-muted"}`}>HOLD</span>
          </span>
        </button>
        <a href={target} className="text-xs text-muted underline underline-offset-4 hover:text-accent-2">
          演出をスキップして会場へ
        </a>
      </div>
    </div>
  );
}

function Stars() {
  // 決定的な疑似乱数で星を配置（SSRとクライアントで一致させる）
  const stars = Array.from({ length: 70 }, (_, i) => {
    const s = Math.sin(i * 12.9898) * 43758.5453;
    const x = (s - Math.floor(s)) * 100;
    const t = Math.sin(i * 78.233) * 43758.5453;
    const y = (t - Math.floor(t)) * 100;
    return { x, y, size: 1 + (i % 3), delay: (i % 7) * 0.4 };
  });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-accent-2 animate-pulse"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, opacity: 0.6, animationDelay: `${s.delay}s` }}
        />
      ))}
    </div>
  );
}
