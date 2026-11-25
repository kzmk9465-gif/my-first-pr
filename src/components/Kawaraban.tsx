"use client";

import { useState } from "react";
import Link from "next/link";

type Item = { id: number; title: string; body: string | null; image_url: string | null; created_at: string };
type Result = { id: number; title: string; headline: string; current_price: number };

/** 画面右下の「新聞」ボタン。お知らせと、終わったオークションの新聞風記事を表示。 */
export default function Kawaraban({ news, results }: { news: Item[]; results: Result[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="fixed right-4 bottom-12 z-50 h-12 w-12 rounded-full border border-accent bg-surface/90 backdrop-blur text-accent-2 font-black shadow-lg" aria-label="播州新聞を開く">新</button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-lg max-h-[85vh] overflow-auto p-4 space-y-4" onClick={(e) => e.stopPropagation()} style={{ fontFamily: '"Hiragino Mincho ProN","Yu Mincho",serif' }}>
            <div className="flex items-center justify-between border-b-2 border-accent pb-2">
              <h2 className="text-2xl font-black text-accent-2 tracking-[0.3em]">播州新聞</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted text-xl" aria-label="閉じる">×</button>
            </div>
            {news.length > 0 && (
              <section className="space-y-2">
                <h3 className="font-bold">お知らせ</h3>
                {news.map((n) => (
                  <article key={n.id} className="text-sm border-l-2 border-accent pl-2">
                    <div className="font-bold">{n.title}</div>
                    {n.image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={n.image_url} alt="" className="my-1 max-h-40 rounded" />}
                    {n.body && <p className="text-muted whitespace-pre-wrap text-xs">{n.body}</p>}
                  </article>
                ))}
              </section>
            )}
            <section className="space-y-2">
              <h3 className="font-bold">激戦の品（直近の落着）</h3>
              {results.length === 0 ? <p className="text-xs text-muted">まだ記事になる落着はありません。</p> : results.map((r) => (
                <p key={r.id} className="text-sm leading-relaxed"><Link href={`/auctions/${r.id}`} className="hover:text-accent-2">{r.headline}</Link></p>
              ))}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
