import Link from "next/link";
import type { Listing } from "@/lib/auctions";
import { CERTIFICATE_LABELS } from "@/lib/config";
import { formatDateTime, remaining, yen } from "@/lib/format";

export default function ListingCard({ l }: { l: Listing }) {
  const ended = l.status === "ended" || l.status === "cancelled";
  return (
    <article className="card overflow-hidden flex flex-col">
      <Link href={`/auctions/${l.id}`} className="block relative aspect-[4/3] bg-surface-2">
        {l.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.image_url} alt={l.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted text-sm">画像なし</div>
        )}
        {l.certificate && (
          <span className="absolute left-2 top-2 badge badge-ok bg-background/80">{CERTIFICATE_LABELS[l.certificate]} ✓</span>
        )}
        {l.status === "scheduled" && <span className="absolute right-2 top-2 badge bg-background/80">開催前</span>}
        {ended && <span className="absolute right-2 top-2 badge bg-background/80">{l.status === "cancelled" ? "取消" : "終了"}</span>}
      </Link>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="text-xs text-muted">
          出品 <Link href={`/sellers/${l.seller_slug}`} className="text-accent-2 hover:underline">{l.seller_name}</Link>
          {l.breeder && l.breeder !== l.seller_name && <> ／ 作出 {l.breeder}</>}
        </div>
        <h3 className="font-bold leading-snug">
          {l.featured ? <span className="badge badge-star mr-1">⭐注目</span> : null}
          {l.hot ? <span className="badge badge-hot mr-1">🔥</span> : null}
          <Link href={`/auctions/${l.id}`} className="hover:text-accent-2">{l.title}</Link>
          <span className="text-muted text-xs ml-1">[ID:{l.id}]</span>
        </h3>
        <div className="mt-auto">
          <div className="text-sm text-muted">{ended ? "落札価格" : "現在価格"}</div>
          <div className="text-xl font-black text-accent-2">{yen(l.current_price)}</div>
          <div className="text-xs text-muted flex justify-between">
            <span>終了：{formatDateTime(l.ends_at)}</span>
            <span>{ended ? `${l.bid_count}件` : remaining(l.ends_at)}</span>
          </div>
        </div>
        <Link href={`/auctions/${l.id}`} className="btn w-full mt-1">
          {ended ? "結果を見る" : "入札ページへ"}
        </Link>
      </div>
    </article>
  );
}
