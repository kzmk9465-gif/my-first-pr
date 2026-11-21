"use client";

import { useEffect, useRef, useState } from "react";

type C = { id: number; kind: string; body: string; label: string; created_at: string };

/**
 * 弾幕コメント。画像の上を右から左へ流れる。3秒ごとに新着を取得。
 * 入札が入ると「○○さんキター!!」がサーバー側で自動投稿される。
 */
export default function Danmaku({ listingId, canPost, enabled }: { listingId: number; canPost: boolean; enabled: boolean }) {
  const [items, setItems] = useState<(C & { lane: number; born: number })[]>([]);
  const [log, setLog] = useState<C[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [show, setShow] = useState(true);
  const lastId = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    try { setShow(localStorage.getItem("banshu_danmaku") !== "0"); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/listings/${listingId}/comments?after=${lastId.current}`, { cache: "no-store" });
        if (!r.ok) return;
        const { items: fresh } = (await r.json()) as { items: C[] };
        if (stop || fresh.length === 0) return;
        lastId.current = fresh[fresh.length - 1].id;
        setLog((l) => [...fresh.slice().reverse(), ...l].slice(0, 30));
        if (!first.current) {
          const born = Date.now();
          setItems((cur) => [...cur, ...fresh.map((c, i) => ({ ...c, lane: (c.id + i) % 5, born: born + i * 400 }))]);
          setTimeout(() => setItems((cur) => cur.filter((c) => Date.now() - c.born < 9000)), 9500);
        }
        first.current = false;
      } catch { /* retry */ }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => { stop = true; clearInterval(id); };
  }, [listingId, enabled]);

  if (!enabled) return null;

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const r = await fetch(`/api/listings/${listingId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) });
    if (!r.ok) { setErr(((await r.json()) as { error?: string }).error ?? "投稿できませんでした"); return; }
    setText("");
  };

  return (
    <div className="space-y-2">
      {show && (
        <div className="pointer-events-none fixed inset-x-0 top-16 h-48 z-30 overflow-hidden" aria-live="polite">
          {items.map((c) => (
            <span key={c.id} className={`absolute whitespace-nowrap font-bold text-lg drop-shadow-[0_0_4px_#000] ${c.kind === "system" ? "text-accent-2" : c.kind === "admin" ? "text-danger" : "text-foreground"}`}
              style={{ top: `${c.lane * 20 + 4}%`, animation: "danmaku 8s linear forwards", animationDelay: `${Math.max(0, c.born - Date.now())}ms` }}>
              {c.kind === "system" ? c.body : `${c.label}: ${c.body}`}
            </span>
          ))}
          <style>{`@keyframes danmaku { from { left: 100%; } to { left: -100%; } }`}</style>
        </div>
      )}
      <div className="card p-3 text-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-accent-2">💬 弾幕コメント</span>
          <button type="button" onClick={() => { const v = !show; setShow(v); try { localStorage.setItem("banshu_danmaku", v ? "1" : "0"); } catch { /* ignore */ } }} className={`badge ${show ? "badge-star" : ""}`}>流す {show ? "入" : "切"}</button>
        </div>
        {canPost ? (
          <form onSubmit={post} className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={60} className="input !py-1" placeholder="ひとこと（60字まで）" />
            <button className="btn !py-1 whitespace-nowrap">投稿</button>
          </form>
        ) : <p className="text-xs text-muted">承認済み会員はコメントできます。</p>}
        {err && <p className="text-danger text-xs mt-1">{err}</p>}
        <ul className="mt-2 max-h-32 overflow-auto text-xs text-muted space-y-0.5">
          {log.map((c) => <li key={c.id}><span className={c.kind === "system" ? "text-accent-2" : c.kind === "admin" ? "text-danger" : ""}>{c.kind === "system" ? c.body : `${c.label}: ${c.body}`}</span></li>)}
        </ul>
      </div>
    </div>
  );
}
