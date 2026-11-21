import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ListingCard from "@/components/ListingCard";
import { finalizeEnded, getSellerBySlug, isFollowing, listListings } from "@/lib/auctions";
import { getCurrentUser } from "@/lib/auth";
import { followAction } from "@/app/auctions/[id]/actions";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = getSellerBySlug((await params).slug);
  return { title: s ? `${s.name} の出品` : "出品者" };
}

export default async function SellerPage({ params }: Props) {
  const seller = getSellerBySlug((await params).slug);
  if (!seller) notFound();
  await finalizeEnded();
  const user = await getCurrentUser();
  const following = user ? isFollowing(user.id, seller.id) : false;
  const open = listListings({ tab: "open", sellerId: seller.id, limit: 60 });
  const ended = listListings({ tab: "ended", sellerId: seller.id, limit: 12 });
  const back = `/sellers/${seller.slug}`;

  return (
    <div className="space-y-6">
      <nav className="text-xs text-muted"><Link href="/auctions" className="hover:text-accent-2">オークション一覧</Link> › 出品者</nav>
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-accent-2">{seller.name}</h1>
          {seller.description && <p className="text-sm text-muted mt-1">{seller.description}</p>}
        </div>
        <form action={followAction}>
          <input type="hidden" name="seller_id" value={seller.id} />
          <input type="hidden" name="back" value={back} />
          <button className={`btn ${following ? "" : "btn-outline"}`}>{following ? "★ フォロー中（解除）" : "☆ 新しい出品をお知らせ"}</button>
        </form>
      </div>
      <section>
        <h2 className="font-bold mb-3">開催中（{open.total}）</h2>
        {open.items.length === 0 ? <p className="text-sm text-muted">開催中の出品はありません。</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{open.items.map((l) => <ListingCard key={l.id} l={l} />)}</div>
        )}
      </section>
      {ended.items.length > 0 && (
        <section>
          <h2 className="font-bold mb-3">終了分</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{ended.items.map((l) => <ListingCard key={l.id} l={l} />)}</div>
        </section>
      )}
    </div>
  );
}
