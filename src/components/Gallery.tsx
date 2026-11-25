"use client";

import { useState } from "react";

type Props = { images: string[]; title: string; silhouette?: boolean; videoId?: string | null };

/** 生体メディアギャラリー。正方形のメイン＋サムネイル列。動画があれば▶サムネから再生。 */
export default function Gallery({ images, title, silhouette = false, videoId = null }: Props) {
  const [sel, setSel] = useState<number | "video">(0);
  const [touchX, setTouchX] = useState<number | null>(null);
  const imgStyle = silhouette ? { filter: "brightness(0) contrast(1.2) blur(2px)", opacity: 0.85 } : undefined;
  const hasMedia = images.length > 0 || !!videoId;

  const go = (d: number) => {
    if (images.length === 0) return;
    setSel((cur) => (cur === "video" ? 0 : (cur + d + images.length) % images.length));
  };

  return (
    <div className="space-y-2">
      <div
        className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-surface-2 shadow-[0_4px_20px_rgba(0,0,0,0.5)] select-none"
        onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
        onTouchEnd={(e) => { if (touchX !== null && sel !== "video") { const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); } setTouchX(null); }}
      >
        {sel === "video" && videoId ? (
          <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1&modestbranding=1&autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=1`} title="遊泳動画" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        ) : !hasMedia ? (
          <div className="h-full w-full flex items-center justify-center text-muted text-sm" style={{ background: "radial-gradient(circle at 50% 35%, rgba(0,240,255,0.08), transparent 60%)" }}>画像なし</div>
        ) : images.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={images[typeof sel === "number" ? sel : 0]} alt={silhouette ? "千両箱（シルエット）" : `${title}`} className="h-full w-full object-contain" style={imgStyle} />
        ) : null}

        {/* 動画バッジ（静止画表示中のみ） */}
        {videoId && sel !== "video" && (
          <button type="button" onClick={() => setSel("video")} className="absolute left-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur px-3 py-1.5 text-xs font-bold text-accent-2 border border-accent/40 hover:bg-black/85">
            ▶ 遊泳動画を見る
          </button>
        )}
        {images.length > 1 && sel !== "video" && (
          <>
            <button type="button" aria-label="前の画像" onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/55 text-accent-2 backdrop-blur">‹</button>
            <button type="button" aria-label="次の画像" onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/55 text-accent-2 backdrop-blur">›</button>
            <span className="absolute right-3 bottom-3 badge !bg-black/70 backdrop-blur">{(typeof sel === "number" ? sel : 0) + 1} / {images.length}</span>
          </>
        )}
      </div>

      {(images.length > 1 || videoId) && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {videoId && (
            <button type="button" onClick={() => setSel("video")} className={`relative shrink-0 h-16 w-16 rounded-lg overflow-hidden border ${sel === "video" ? "border-accent" : "border-white/10 opacity-80"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} alt="動画" className="h-full w-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center text-white text-lg bg-black/30">▶</span>
            </button>
          )}
          {images.map((src, n) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src + n} src={src} alt="" onClick={() => setSel(n)} style={imgStyle} className={`shrink-0 h-16 w-16 object-cover rounded-lg cursor-pointer border ${sel === n ? "border-accent" : "border-white/10 opacity-70"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
