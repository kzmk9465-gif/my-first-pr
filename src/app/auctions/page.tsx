import type { Metadata } from "next";
import Link from "next/link";
import ListingCard from "@/components/ListingCard";
import { finalizeEnded, listListings } from "@/lib/auctions";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = { title: "オークション一覧" };
export const dynamic = "force-dynamic";

type Search = { tab?: string; end?: string; sort?: string; page?: string };
const PAGE_SIZE = 24;

export default async function AuctionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  await finalizeEnded();
  const tab = sp.tab === "ended" ? "ended" : "open";
  const endWithin = (["today", "tomorrow", "3days"] as const).find((v) => v === sp.end);
  const sort = (["ending", "price_desc", "price_asc", "newest"] as const).find((v) => v === sp.sort) ?? "ending";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const { items, total } = listListings({ tab, endWithin, sort, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const q = (over: Partial<Search>) => {
    const p = new URLSearchParams();
    const merged = { tab, end: endWithin, sort, ...over } as Record<string, string | undefined>;
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "sort" && v === "ending") && !(k === "tab" && v === "open")) p.set(k, v);
    const s = p.toString();
    return `/auctions${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="text-[10px] tracking-[0.4em] text-muted">{siteConfig.tagline}</div>
        <h1 className="text-2xl font-black text-accent-2 tracking-widest">オークション一覧</h1>
      </div>

      <div className="flex border-b border-accent/20">
        <Link href={q({ tab: "open", end: undefined })} className={`tab ${tab === "open" ? "tab-active" : ""}`}>開催中</Link>
        <Link href={q({ tab: "ended", end: undefined })} className={`tab ${tab === "ended" ? "tab-active" : ""}`}>終了分</Link>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {tab === "open" && (
          <>
            <span className="text-muted self-center">▼ 絞り込み：</span>
            {[
              ["", "すべて"],
              ["today", "本日終了"],
              ["tomorrow", "明日終了"],
              ["3days", "3日以内に終了"],
            ].map(([v, label]) => (
              <Link key={v} href={q({ end: v || undefined })} className={`badge ${(endWithin ?? "") === v ? "badge-star" : ""}`}>{label}</Link>
            ))}
          </>
        )}
        <span className="text-muted self-center ml-2">⇅ 並び替え：</span>
        {[
          ["ending", tab === "open" ? "終了が近い順" : "新しい順"],
          ["price_desc", "高額順"],
          ["price_asc", "安値順"],
          ["newest", "出品が新しい順"],
        ].map(([v, label]) => (
          <Link key={v} href={q({ sort: v })} className={`badge ${sort === v ? "badge-star" : ""}`}>{label}</Link>
        ))}
      </div>

      <p className="text-xs text-muted">☆ 出品者ページの☆を押すと、その出品者の新しい出品をお知らせします。全 {total} 件</p>

      {items.length === 0 ? (
        <div className="card p-10 text-center text-muted">該当する出品はありません。</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((l) => <ListingCard key={l.id} l={l} />)}
        </div>
      )}

      {pages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 && <Link className="btn btn-outline" href={q({ page: String(page - 1) })}>← 前へ</Link>}
          <span className="self-center text-muted">{page} / {pages}</span>
          {page < pages && <Link className="btn btn-outline" href={q({ page: String(page + 1) })}>もっと見る →</Link>}
        </div>
      )}
    </div>
  );
}
