import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { endedWithWinners, finalizeEnded, getUserById, listListings } from "@/lib/auctions";
import { formatDateTime, yen } from "@/lib/format";
import { cancelListingAction } from "./actions";

export const metadata: Metadata = { title: "管理" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/auctions");
  await finalizeEnded();
  const open = listListings({ tab: "open", limit: 200 });
  const ended = endedWithWinners(50);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-accent-2">管理</h1>
        <div className="flex gap-2">
          <Link href="/admin/sellers" className="btn btn-outline">出品者管理</Link>
          <Link href="/admin/listings/new" className="btn">＋ 新規出品</Link>
        </div>
      </div>

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
          <thead className="text-muted text-xs text-left"><tr><th className="py-1">ID</th><th>タイトル</th><th className="text-right">落札価格</th><th>落札者・発送先</th><th>終了</th></tr></thead>
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
