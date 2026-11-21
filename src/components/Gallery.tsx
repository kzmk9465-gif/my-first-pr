"use client";

import { useState } from "react";

/** 画像ギャラリー。複数枚はサムネイルで切り替え、左右スワイプにも対応。 */
export default function Gallery({ images, title, silhouette = false }: { images: string[]; title: string; silhouette?: boolean }) {
  const imgStyle = silhouette ? { filter: "brightness(0) contrast(1.2) blur(2px)", opacity: 0.85 } : undefined;
  const [i, setI] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);
  if (images.length === 0) {
    return <div className="card overflow-hidden aspect-[4/3] bg-surface-2 flex items-center justify-center text-muted">画像なし</div>;
  }
  const go = (d: number) => setI((n) => (n + d + images.length) % images.length);
  return (
    <div className="space-y-2">
      <div
        className="card overflow-hidden aspect-[4/3] bg-surface-2 relative select-none"
        onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
        onTouchEnd={(e) => { if (touchX !== null) { const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); } setTouchX(null); }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[i]} alt={silhouette ? "千両箱（シルエット）" : `${title} ${i + 1}`} className="h-full w-full object-contain" style={imgStyle} />
        {images.length > 1 && (
          <>
            <button type="button" aria-label="前の画像" onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/70 text-accent-2">‹</button>
            <button type="button" aria-label="次の画像" onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/70 text-accent-2">›</button>
            <span className="absolute right-2 bottom-2 badge bg-background/80">{i + 1} / {images.length}</span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((src, n) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src + n} src={src} alt="" onClick={() => setI(n)} style={imgStyle} className={`h-16 w-20 object-cover rounded cursor-pointer border ${n === i ? "border-accent" : "border-transparent opacity-70"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
