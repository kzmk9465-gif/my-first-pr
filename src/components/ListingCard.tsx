import Link from "next/link";
import type { Listing } from "@/lib/auctions";
import { CERTIFICATE_LABELS } from "@/lib/config";
import { formatDateTime, remaining, yen } from "@/lib/format";
import { favoriteAction } from "@/app/auctions/[id]/actions";

export default function ListingCard({ l, fav = false, back }: { l: Listing; fav?: boolean; back?: string }) {
  const ended = l.status === "ended" || l.status === "cancelled";
  const soon = !ended && new Date(l.ends_at).getTime() - Date.now() < 60 * 60_000; // 残り1時間未満
  return (
    <article className="card group overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/45 hover:shadow-[0_18px_40px_-22px_rgba(0,0,0,0.9)]">
      <div className="relative overflow-hidden">
        <Link href={`/auctions/${l.id}`} className="block relative aspect-[4/3] bg-surface-2">
          {l.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.image_url} alt={l.mystery ? "千両箱" : l.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" style={l.mystery ? { filter: "brightness(0) contrast(1.2) blur(2px)", opacity: 0.85 } : undefined} />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted text-sm" style={{ background: "radial-gradient(circle at 50% 35%, rgba(201,162,74,0.08), transparent 60%)" }}>画像なし</div>
          )}
          {/* 下側のグラデーションで文字を読みやすく */}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
          {l.certificate && (
            <span className="absolute left-2 top-2 badge badge-ok !bg-background/85 backdrop-blur-sm">{CERTIFICATE_LABELS[l.certificate]} ✓</span>
          )}
          {l.status === "scheduled" && <span className="absolute right-2 top-2 badge !bg-background/85 backdrop-blur-sm">開催前</span>}
          {ended && <span className="absolute right-2 top-2 badge !bg-background/85 backdrop-blur-sm">{l.status === "cancelled" ? "取消" : "終了"}</span>}
        </Link>
        <form action={favoriteAction} className="absolute right-2 bottom-2">
          <input type="hidden" name="listing_id" value={l.id} />
          <input type="hidden" name="back" value={back ?? "/auctions"} />
          <button aria-label={fav ? "お気に入り解除" : "お気に入りに追加"} className={`h-9 w-9 rounded-full bg-background/80 border border-accent/40 text-lg backdrop-blur-sm transition hover:scale-110 ${fav ? "text-danger" : "text-muted hover:text-accent-2"}`}>
            {fav ? "♥" : "♡"}
          </button>
        </form>
      </div>
      <div className="p-3.5 flex flex-col gap-2 flex-1">
        <div className="text-xs text-muted">
          出品 <Link href={`/sellers/${l.seller_slug}`} className="text-accent-2 hover:underline">{l.seller_name}</Link>
          {l.breeder && l.breeder !== l.seller_name && <> ／ 作出 {l.breeder}</>}
        </div>
        {(Boolean(l.featured) || Boolean(l.hot) || l.min_rank > 0 || Boolean(l.passphrase_hash) || Boolean(l.mystery)) && (
          <div className="flex flex-wrap gap-1">
            {l.featured ? <span className="badge badge-star">⭐注目</span> : null}
            {l.hot ? <span className="badge badge-hot">🔥 白熱</span> : null}
            {l.min_rank > 0 ? <span className="badge badge-hot">🌑 闇市</span> : null}
            {l.passphrase_hash ? <span className="badge badge-star">🔒 限定</span> : null}
            {l.mystery ? <span className="badge badge-star">📦 千両箱</span> : null}
          </div>
        )}
        <h3 className="font-bold leading-snug">
          <Link href={`/auctions/${l.id}`} className="hover:text-accent-2">{l.title}</Link>
          <span className="text-muted text-xs ml-1">[ID:{l.id}]</span>
        </h3>
        <div className="mt-auto pt-2">
          <div className="hairline mb-2" />
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] text-muted tracking-wide">{ended ? "落札価格" : "現在価格"}</div>
              <div className="text-2xl price-focus leading-tight">{yen(l.current_price)}</div>
            </div>
            <span className={`text-xs ${ended ? "text-muted" : soon ? "text-urgent font-bold" : "text-ok"}`}>{ended ? `入札 ${l.bid_count}件` : remaining(l.ends_at)}</span>
          </div>
          <div className="text-[11px] text-muted mt-0.5">終了：{formatDateTime(l.ends_at)}</div>
        </div>
        <Link href={`/auctions/${l.id}`} className="btn w-full mt-1">
          {ended ? "結果を見る" : "入札ページへ"}
        </Link>
      </div>
    </article>
  );
}
