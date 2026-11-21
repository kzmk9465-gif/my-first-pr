import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sellerContext } from "@/lib/seller-gate";
import { feeBreakdown, ordersForSeller, sellerSummary } from "@/lib/sellers";
import { finalizeEnded, listingsForSeller } from "@/lib/auctions";
import { ORDER_STATUS_LABELS } from "@/lib/config";
import { formatDateTime, yen } from "@/lib/format";
import { orderStatusAction, sellerCancelListingAction } from "../actions";

export const metadata: Metadata = { title: "出品者ダッシュボード" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { review: "確認待ち", scheduled: "開催前", open: "開催中", ended: "終了", cancelled: "取消" };

export default async function SellerDashboard({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; q?: string; updated?: string }> }) {
  const sp = await searchParams;
  const { user, seller, pinOk } = await sellerContext();
  if (!user) redirect("/login?next=/sell/dashboard");
  if (!seller) redirect("/sell");
  if (!pinOk) redirect("/sell/pin?next=/sell/dashboard");
  await finalizeEnded();
  const q = (sp.q ?? "").trim();
  const listings = listingsForSeller(seller.id).filter((l) => !q || l.title.includes(q) || String(l.id) === q);
  const orders = ordersForSeller(seller.id);
  const sum = sellerSummary(seller.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-accent-2">出品者ダッシュボード</h1>
          <p className="text-xs text-muted">{seller.name} ・ 手数料 {seller.fee_rate}% ・ <Link href="/sell/settings" className="underline">送料・支払い案内の設定</Link></p>
        </div>
        <Link href="/sell/new" className="btn">＋ 出品する</Link>
      </div>
      {sp.saved && <p className="text-ok text-sm border border-ok/40 rounded p-2">出品 ID:{sp.saved} を受け付けました。{user.role !== "admin" && "お店の確認後に公開されます。"}</p>}
      {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}
      {sp.updated && <p className="text-ok text-sm border border-ok/40 rounded p-2">取引の状態を更新しました。</p>}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        {[["落札件数", `${sum.sold_count} 件`], ["売上合計", yen(sum.gross)], [`手数料（${seller.fee_rate}%）`, yen(sum.fee)], ["お戻し", yen(sum.payout)]].map(([k, v]) => (
          <div key={k} className="card p-3"><div className="text-xs text-muted">{k}</div><div className="text-lg font-black text-accent-2">{v}</div></div>
        ))}
      </section>

      <section className="card p-4" id="orders">
        <h2 className="font-bold text-accent-2 mb-2">取引（落札後の手続き）</h2>
        {orders.length === 0 ? <p className="text-sm text-muted">まだ落札された取引はありません。</p> : (
          <div className="space-y-3">
            {orders.map((o) => {
              const fb = feeBreakdown(o.price, o.fee_rate);
              return (
                <div key={o.listing_id} className="border border-accent/10 rounded p-3 text-sm grid gap-2 md:grid-cols-[1fr_auto]">
                  <div>
                    <div className="font-bold"><Link href={`/auctions/${o.listing_id}`} className="hover:text-accent-2">{o.title}</Link> <span className={`badge ${o.status === "awaiting_payment" ? "badge-hot" : o.status === "completed" ? "badge-ok" : "badge-star"}`}>{ORDER_STATUS_LABELS[o.status]}</span></div>
                    <div className="text-xs text-muted">落札 {yen(o.price)} ＋ 送料 {yen(o.shipping_fee)}（{o.shipping_method === "cool" ? "クール便" : "常温便"}） ＝ 請求 <b className="text-foreground">{yen(o.price + o.shipping_fee)}</b> ／ 手数料 {yen(fb.fee)} ／ お戻し {yen(fb.payout)}</div>
                    <div className="text-xs mt-1">落札者：{o.buyer_name ?? ""} &lt;{o.buyer_email}&gt;{o.buyer_line && <span className="badge badge-ok ml-1">LINE</span>}</div>
                    <div className="text-xs text-muted">{o.shipping_address ? `〒${o.shipping_postal} ${o.shipping_address} ${o.shipping_name ?? ""} ${o.shipping_phone ?? ""}` : <span className="text-danger">発送先未登録</span>}</div>
                    {(o.carrier || o.tracking_no) && <div className="text-xs text-muted">発送：{o.carrier} {o.tracking_no}</div>}
                    <div className="text-xs text-muted">{formatDateTime(o.created_at)} 落札</div>
                  </div>
                  <form action={orderStatusAction} className="flex flex-col gap-1 min-w-48">
                    <input type="hidden" name="listing_id" value={o.listing_id} />
                    {o.status === "awaiting_payment" && (<>
                      <button name="status" value="paid" className="btn !py-1 text-xs">入金を確認した</button>
                      <button name="status" value="cancelled" className="btn btn-outline !py-1 text-xs">取消（不払い）</button>
                    </>)}
                    {o.status === "paid" && (<>
                      <input name="carrier" className="input !py-1 text-xs" placeholder="配送業者（例: ヤマト運輸）" defaultValue={o.carrier ?? ""} />
                      <input name="tracking_no" className="input !py-1 text-xs" placeholder="追跡番号" defaultValue={o.tracking_no ?? ""} />
                      <button name="status" value="shipped" className="btn !py-1 text-xs">発送した（落札者に通知）</button>
                      <button name="status" value="awaiting_payment" className="btn btn-outline !py-1 text-xs">支払い待ちに戻す</button>
                    </>)}
                    {o.status === "shipped" && (<>
                      <button name="status" value="completed" className="btn !py-1 text-xs">受け取り完了にする</button>
                      <button name="status" value="paid" className="btn btn-outline !py-1 text-xs">入金確認に戻す</button>
                    </>)}
                    {o.status === "cancelled" && <button name="status" value="awaiting_payment" className="btn btn-outline !py-1 text-xs">取消を解除</button>}
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="font-bold text-accent-2">自分の出品（{listings.length}）</h2>
          <form method="get" className="flex gap-1"><input name="q" defaultValue={q} placeholder="タイトル・IDで検索" className="input !py-1 text-xs" /><button className="btn btn-outline !py-1 text-xs">検索</button></form>
        </div>
        <table className="w-full text-sm">
          <thead className="text-muted text-xs text-left"><tr><th className="py-1">ID</th><th>タイトル</th><th>状態</th><th className="text-right">現在価格</th><th className="text-right pr-3">入札</th><th>終了</th><th></th></tr></thead>
          <tbody className="divide-y divide-accent/10">
            {listings.map((l) => (
              <tr key={l.id}>
                <td className="py-2 text-muted">{l.id}</td>
                <td className="py-2"><Link href={`/auctions/${l.id}`} className="hover:text-accent-2">{l.title}</Link></td>
                <td className="py-2"><span className={`badge ${l.status === "open" ? "badge-ok" : l.status === "review" ? "badge-hot" : ""}`}>{STATUS_LABEL[l.status]}</span></td>
                <td className="py-2 text-right whitespace-nowrap">{yen(l.current_price)}</td>
                <td className="py-2 text-right pr-3">{l.bid_count}</td>
                <td className="py-2 text-xs whitespace-nowrap">{formatDateTime(l.ends_at)}</td>
                <td className="py-2 text-right">
                  {(l.status === "review" || ((l.status === "open" || l.status === "scheduled") && l.bid_count === 0)) && (
                    <form action={sellerCancelListingAction}><input type="hidden" name="id" value={l.id} /><button className="text-xs text-danger underline">取下げ</button></form>
                  )}
                </td>
              </tr>
            ))}
            {listings.length === 0 && <tr><td colSpan={7} className="py-4 text-muted">出品はまだありません。</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
