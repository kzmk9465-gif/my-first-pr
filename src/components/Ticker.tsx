"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type T = { id: number; listing_id: number; title: string; label: string; amount: number; created_at: string };

/** 画面下部の入札速報。5秒ごとに更新し、横に流れる。 */
export default function Ticker({ initial }: { initial: T[] }) {
  const [items, setItems] = useState<T[]>(initial);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try { setHidden(localStorage.getItem("banshu_ticker") === "0"); } catch { /* ignore */ }
    const id = setInterval(async () => {
      try { const r = await fetch("/api/ticker", { cache: "no-store" }); if (r.ok) setItems(((await r.json()) as { items: T[] }).items); } catch { /* retry */ }
    }, 5000);
    return () => clearInterval(id);
  }, []);
  if (hidden || items.length === 0) return null;
  const text = items.map((t) => `📢 ${t.label} が「${t.title.slice(0, 24)}」に ${t.amount.toLocaleString("ja-JP")}円`);
  return (
    <div className="fixed bottom-0 inset-x-0 z-30 bg-background/90 backdrop-blur border-t border-accent/30 text-xs h-8 flex items-center overflow-hidden">
      <span className="px-2 font-bold text-accent-2 whitespace-nowrap">速報</span>
      <div className="flex-1 overflow-hidden relative h-full">
        <div className="absolute whitespace-nowrap flex gap-8 items-center h-full" style={{ animation: `ticker ${Math.max(30, text.length * 7)}s linear infinite` }}>
          {items.map((t, i) => <Link key={t.id} href={`/auctions/${t.listing_id}`} className="hover:text-accent-2">{text[i]}</Link>)}
          {items.map((t, i) => <Link key={`b${t.id}`} href={`/auctions/${t.listing_id}`} className="hover:text-accent-2">{text[i]}</Link>)}
        </div>
      </div>
      <button type="button" onClick={() => { setHidden(true); try { localStorage.setItem("banshu_ticker", "0"); } catch { /* ignore */ } }} className="px-2 text-muted" aria-label="速報を閉じる">×</button>
      <style>{`@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}
