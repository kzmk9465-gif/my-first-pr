import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, listMembers } from "@/lib/auth";
import { endedWithWinners, finalizeEnded, getUserById, listListings, reviewListings } from "@/lib/auctions";
import { getOrder } from "@/lib/sellers";
import { pendingSecondaryCertificates } from "@/lib/certificates";
import { ORDER_STATUS_LABELS } from "@/lib/config";
import { formatDateTime, yen } from "@/lib/format";
import { cancelListingAction, publishListingAction, rejectListingAction } from "./actions";

export const metadata: Metadata = { title: "管理" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/auctions");
  await finalizeEnded();
  const open = listListings({ tab: "open", limit: 200 });
  const pendingCount = listMembers("pending").length;
  const review = reviewListings();
  const pendingCerts = pendingSecondaryCertificates().length;
  const ended = endedWithWinners(50);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-accent-2">管理</h1>
        <div className="flex gap-2">
          <Link href="/admin/members" className="btn btn-outline">会員管理{pendingCount > 0 && <span className="badge badge-hot ml-1">{pendingCount}</span>}</Link>
          <Link href="/admin/sellers" className="btn btn-outline">出品者管理</Link>
          <Link href="/admin/certificates" className="btn btn-outline">証明書{pendingCerts > 0 && <span className="badge badge-hot ml-1">{pendingCerts}</span>}</Link>
          <Link href="/admin/listings/new" className="btn">＋ 新規出品</Link>
        </div>
      </div>

      {review.length > 0 && (
        <section className="card p-4 border-accent/50">
          <h2 className="font-bold text-accent-2 mb-2">確認待ちの出品（{review.length}）</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-accent/10">
              {review.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 text-muted">{l.id}</td>
                  <td className="py-2"><Link href={`/auctions/${l.id}`} className="hover:text-accent-2">{l.title}</Link><div className="text-xs text-muted">{l.seller_name} ・ 開始 {yen(l.start_price)}{l.buyout_price ? ` ・ 即決 ${yen(l.buyout_price)}` : ""} ・ 終了 {formatDateTime(l.ends_at)}</div></td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <form action={publishListingAction} className="inline"><input type="hidden" name="id" value={l.id} /><button className="btn !py-1 text-xs">公開</button></form>
                    <form action={rejectListingAction} className="inline ml-1"><input type="hidden" name="id" value={l.id} /><button className="btn btn-outline !py-1 text-xs">却下</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card p-4">
        <h2 className="font-bold text-accent-2 mb-2">開催中・開催前（{open.total}）</h2>
        <table className="w-full text-sm">
          <thead className="text-muted text-xs text-left"><tr><th className="py-1">ID</th><th>タイトル</th><th className="text-right">現在価格</th><th className="text-right">入札</th><th>終了</th><th></th></tr></thead>
          <tbody className="divide-y divide-accent/10">
            {open.items.map((l) => (
              <tr key={l.id}>
                <td className="py-2 text-muted">{l.id}</td>
                <td className="py-2"><Link href={`/auctions/${l.id}`} className="hover:text-accent-2">{l.title}</Link><div className="text-xs text-muted">{l.seller_name}{l.status === "scheduled" && " ・開催前"}</div></td>
                <td className="py-2 text-right font-bold whitespace-nowrap">{yen(l.current_price)}</td>
                <td className="py-2 text-right">{l.bid_count}</td>
                <td className="py-2 text-xs whitespace-nowrap">{formatDateTime(l.ends_at)}</td>
                <td className="py-2 text-right">
                  <form action={cancelListingAction}><input type="hidden" name="id" value={l.id} /><button className="text-xs text-danger underline">取消</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-4">
        <h2 className="font-bold text-accent-2 mb-2">終了分と落札者（直近50件）</h2>
        <table className="w-full text-sm">
          <thead className="text-muted text-xs text-left"><tr><th className="py-1">ID</th><th>タイトル</th><th className="text-right">落札価格</th><th>落札者・発送先</th><th>取引</th><th>終了</th></tr></thead>
          <tbody className="divide-y divide-accent/10">
            {ended.map((l) => {
              const w = l.winner_id ? getUserById(l.winner_id) : undefined;
              return (
                <tr key={l.id}>
                  <td className="py-2 text-muted">{l.id}</td>
                  <td className="py-2"><Link href={`/auctions/${l.id}`} className="hover:text-accent-2">{l.title}</Link></td>
                  <td className="py-2 text-right font-bold whitespace-nowrap">{l.bid_count ? yen(l.current_price) : <span className="text-muted">入札なし</span>}</td>
                  <td className="py-2 text-xs">
                    {w ? (
                      <>
                        <div>{w.name ?? ""} &lt;{w.email}&gt;</div>
                        {w.shipping_address ? <div className="text-muted">{w.shipping_name} 〒{w.shipping_postal} {w.shipping_address} {w.shipping_phone}</div> : <div className="text-danger">発送先未登録</div>}
                      </>
                    ) : <span className="text-muted">-</span>}
                  </td>
                  <td className="py-2 text-xs whitespace-nowrap">{(() => { const o = getOrder(l.id); return o ? ORDER_STATUS_LABELS[o.status] : "-"; })()}</td>
                  <td className="py-2 text-xs whitespace-nowrap">{formatDateTime(l.ends_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
