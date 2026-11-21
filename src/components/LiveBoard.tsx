"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LiveState } from "@/lib/auctions";

type Props = { listingId: number; initial: LiveState; open: boolean; myUserId: number | null; highBidThreshold?: number };

function yen(n: number) { return `${n.toLocaleString("ja-JP")} 円`; }
function fmt(iso: string) { return new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

/**
 * 入札画面のライブ表示。3秒ごとに状態を取り、価格・残り時間・履歴を更新し、
 * 入札エフェクト／桜吹雪／一騎打ち／10分前の煽りを出す。
 */
export default function LiveBoard({ listingId, initial, open, myUserId, highBidThreshold = 10000 }: Props) {
  const router = useRouter();
  const [s, setS] = useState<LiveState>(initial);
  // 水和ずれを避けるため、時刻に依存する表示はマウント後にだけ描く
  const [now, setNow] = useState<number | null>(null);
  const [flash, setFlash] = useState<null | "bid" | "big">(null);
  const [petals, setPetals] = useState(0);
  const [sound, setSound] = useState(false);
  const [fx, setFx] = useState(true);
  const prev = useRef(initial);
  const ended = useRef(false);
  const warned = useRef(false);

  useEffect(() => {
    try { setSound(localStorage.getItem("banshu_sound") === "1"); setFx(localStorage.getItem("banshu_fx") !== "0"); } catch { /* ignore */ }
  }, []);

  // ポーリング
  useEffect(() => {
    if (!open) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/listings/${listingId}/live`, { cache: "no-store" });
        if (!r.ok) return;
        const next = (await r.json()) as LiveState;
        if (stop) return;
        const p = prev.current;
        if (next.current_price > p.current_price || next.bid_count > p.bid_count) {
          const big = next.current_price - p.current_price >= highBidThreshold || next.current_price >= highBidThreshold * 5;
          if (fx) {
            setFlash(big ? "big" : "bid");
            setTimeout(() => setFlash(null), 1600);
            if (big) { setPetals((n) => n + 1); setTimeout(() => setPetals((n) => Math.max(0, n - 1)), 4000); }
          }
          if (sound) beep(big ? 880 : 660, big ? 3 : 1);
        }
        prev.current = next;
        setS(next);
        if (next.status !== "open" && !ended.current) { ended.current = true; setTimeout(() => router.refresh(), 1200); }
      } catch { /* 次回に再試行 */ }
    };
    const id = setInterval(tick, 3000);
    return () => { stop = true; clearInterval(id); };
  }, [listingId, open, router, fx, sound, highBidThreshold]);

  // 残り時間の秒針
  useEffect(() => { setNow(Date.now()); const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const mounted = now !== null;
  const left = mounted ? new Date(s.ends_at).getTime() - now : Infinity;
  const lastSpurt = open && left > 0 && left <= 10 * 60_000;
  useEffect(() => {
    if (lastSpurt && !warned.current) { warned.current = true; if (sound) beep(523, 2); }
  }, [lastSpurt, sound]);

  const hhmmss = !mounted ? "--:--:--" : left <= 0 ? "00:00:00" : [Math.floor(left / 3600_000), Math.floor((left % 3600_000) / 60_000), Math.floor((left % 60_000) / 1000)].map((n) => String(n).padStart(2, "0")).join(":");
  const toggle = (k: "sound" | "fx") => {
    if (k === "sound") { const v = !sound; setSound(v); try { localStorage.setItem("banshu_sound", v ? "1" : "0"); } catch { /* ignore */ } if (v) beep(660, 1); }
    else { const v = !fx; setFx(v); try { localStorage.setItem("banshu_fx", v ? "1" : "0"); } catch { /* ignore */ } }
  };

  return (
    <div className="relative">
      {flash && <div className={`pointer-events-none absolute -inset-2 rounded-xl animate-pulse ${flash === "big" ? "ring-4 ring-accent-2 shadow-[0_0_60px_rgba(233,200,119,.6)]" : "ring-2 ring-ok/70"}`} />}
      {petals > 0 && <Petals />}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm text-muted">{open ? "現在価格" : s.status === "ended" ? "落札価格" : "価格"}</div>
          <div className={`text-4xl price-focus transition-transform ${flash ? "scale-110" : ""}`}>{yen(s.current_price)}</div>
          <div className="text-xs text-muted">入札 {s.bid_count} 件{s.leader_label && open ? ` ・ 現在トップ ${s.leader_label}` : ""}{s.heat && <span className="badge badge-hot ml-2">🔥 ヒートアップ中</span>}</div>
        </div>
        <div className="text-[10px] text-right space-y-1">
          <button type="button" onClick={() => toggle("sound")} className={`badge ${sound ? "badge-star" : ""}`}>♪ 音 {sound ? "入" : "切"}</button>
          <br />
          <button type="button" onClick={() => toggle("fx")} className={`badge ${fx ? "badge-star" : ""}`}>🎬 演出 {fx ? "入" : "切"}</button>
        </div>
      </div>

      {open && (
        <div className={`mt-2 text-sm ${lastSpurt ? "text-urgent" : "text-ok"}`}>
          <span className="font-mono text-xl font-bold">{hhmmss}</span>
          <span className="text-muted ml-2" suppressHydrationWarning>（終了 {mounted ? fmt(s.ends_at) : ""}{s.extended_count > 0 ? ` ・ ${s.extended_count}回延長` : ""}）</span>
          {lastSpurt && fx && (
            <div className="mt-1 rounded border border-urgent/60 bg-urgent/10 px-2 py-1 text-xs font-bold animate-pulse" style={{ color: "var(--urgent)" }}>
              ⚔ 終了10分前。ここからが合戦。最後まで目を離すな！
            </div>
          )}
        </div>
      )}

      {s.duel && open && fx && (
        <div className="mt-2 rounded border border-accent/40 p-2 text-xs">
          <div className="font-bold text-accent-2 mb-1">⚔ 一騎打ち発生中！</div>
          <div className="flex items-center gap-2">
            <span className="w-20 truncate">{s.duel.a}</span>
            <div className="flex-1 h-3 rounded overflow-hidden bg-surface-2 flex">
              <div className="bg-accent" style={{ width: `${(100 * s.duel.a_count) / (s.duel.a_count + s.duel.b_count)}%` }} />
              <div className="bg-danger flex-1" />
            </div>
            <span className="w-20 truncate text-right">{s.duel.b}</span>
          </div>
        </div>
      )}

      <div className="mt-3">
        <div className="text-xs text-muted mb-1">入札履歴（最新10件・自動更新）</div>
        {s.recent.length === 0 ? <p className="text-sm text-muted">まだ入札はありません。</p> : (
          <ol className="text-sm divide-y divide-accent/10">
            {s.recent.map((b, i) => (
              <li key={b.id} className={`py-1 flex justify-between gap-2 ${i === 0 && flash ? "text-accent-2" : ""}`}>
                <span className="truncate">{i === 0 && open ? "🏆 " : ""}{myUserId === b.user_id ? "あなた" : b.label}{b.is_auto ? <span className="text-xs text-muted"> (自動)</span> : null}</span>
                <span className="text-muted text-xs whitespace-nowrap" suppressHydrationWarning>{mounted ? fmt(b.created_at) : ""}</span>
                <span className="font-bold whitespace-nowrap">{yen(b.amount)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

/** 桜吹雪 */
function Petals() {
  const items = Array.from({ length: 24 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 8) * 0.25, size: 8 + (i % 4) * 3, dur: 3 + (i % 3) }));
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {items.map((p, i) => (
        <span key={i} className="absolute -top-4 rounded-full" style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.8, background: "radial-gradient(circle at 30% 30%, #ffd6e7, #f78fb3)", animation: `petal ${p.dur}s linear ${p.delay}s 1 forwards`, opacity: 0.9 }} />
      ))}
      <style>{`@keyframes petal { 0% { transform: translateY(-10px) rotate(0deg); } 100% { transform: translateY(110vh) translateX(60px) rotate(540deg); opacity: 0; } }`}</style>
    </div>
  );
}

/** 音声ファイルなしで鳴らす短い合図音 */
function beep(freq: number, times: number) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq; o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.start(t); o.stop(t + 0.16);
    }
  } catch { /* 音が出せない環境 */ }
}
