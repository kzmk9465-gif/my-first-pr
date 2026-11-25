import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { KIND_LABEL, ORDER_EXPIRE_DAYS, RARITY_LABEL, packageViews, pendingOrders, prizeTotal, shippingRequests } from "@/lib/oripa";
import { formatDateTime } from "@/lib/format";
import { addOripaPrizeAction, confirmOripaOrderAction, createOripaPackageAction, deleteOripaPrizeAction, oripaPackageStatusAction, shipOripaDrawAction } from "../actions";

export const metadata: Metadata = { title: "播州くじの管理" };
export const dynamic = "force-dynamic";

const yen = (n: number) => `${n.toLocaleString("ja-JP")} 円`;

export default async function AdminOripaPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/oripa");
  if (user.role !== "admin") redirect("/auctions");
  const sp = await searchParams;
  const pkgs = packageViews(false);
  const pending = pendingOrders();
  const ships = shippingRequests();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-black text-accent-2">播州くじの管理</h1>
        <Link href="/oripa" className="btn btn-outline !py-1 text-xs">公開ページを見る</Link>
      </div>
      <p className="text-xs text-muted">くじは「箱売り」です。総口数と各賞の本数を先に決め、本数の合計が総口数と一致したものだけ販売されます。全口が賞品付き（はずれ無し）。当選品は必ず発送し、ポイント化・買い取りはしません。</p>
      {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}
      {sp.saved && <p className="text-ok text-sm border border-ok/40 rounded p-2">保存しました。</p>}

      {/* 入金待ち */}
      <section className="card p-4">
        <h2 className="font-bold text-accent-2 mb-2">入金待ちの注文（{pending.length}）</h2>
        {pending.length === 0 ? <p className="text-sm text-muted">入金待ちはありません。</p> : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-accent/10">
              {pending.map((o) => (
                <tr key={o.id}>
                  <td className="py-2 tnum font-bold">{o.token.slice(-6).toUpperCase()}</td>
                  <td className="py-2">{o.package_name} {o.count}口 <b className="tnum text-accent-2">{yen(o.amount_yen)}</b><div className="text-xs text-muted">{o.name ?? ""} &lt;{o.email}&gt; ・ {formatDateTime(o.created_at)} ・ {o.provider === "mock" ? "テスト決済" : "銀行振込"}</div></td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <form action={confirmOripaOrderAction} className="inline"><input type="hidden" name="token" value={o.token} /><button className="btn !py-1 text-xs">入金確認</button></form>
                    <form action={confirmOripaOrderAction} className="inline ml-1"><input type="hidden" name="token" value={o.token} /><input type="hidden" name="cancel" value="1" /><button className="btn btn-outline !py-1 text-xs">取消</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-[11px] text-muted mt-1">通帳で注文番号と金額を確認してから「入金確認」。{ORDER_EXPIRE_DAYS}日過ぎた未入金は自動で無効になります。</p>
      </section>

      {/* 発送依頼 */}
      <section className="card p-4">
        <h2 className="font-bold text-accent-2 mb-2">発送依頼が来ている当選品（{ships.length}）</h2>
        {ships.length === 0 ? <p className="text-sm text-muted">発送待ちはありません。</p> : (
          <div className="divide-y divide-accent/10 text-sm">
            {ships.map((s) => (
              <div key={s.id} className="py-2 flex flex-wrap justify-between gap-2">
                <div><span className="badge badge-star mr-1">{RARITY_LABEL[s.rarity]}</span><b>{s.prize_name}</b> <span className="text-xs text-muted">({KIND_LABEL[s.kind]})</span>
                  <div className="text-xs text-muted">{s.shipping_name ?? s.name ?? ""} 〒{s.shipping_postal ?? ""} {s.shipping_address ?? "発送先未登録"} {s.shipping_phone ?? ""} &lt;{s.email}&gt; ・ 当選 {formatDateTime(s.created_at)}</div></div>
                <form action={shipOripaDrawAction}><input type="hidden" name="id" value={s.id} /><button className="btn !py-1 text-xs">発送済みにする</button></form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* くじの作成 */}
      <section className="card p-4">
        <h2 className="font-bold text-accent-2 mb-2">くじを作る</h2>
        <form action={createOripaPackageAction} className="grid gap-2 md:grid-cols-6 text-sm">
          <input name="name" required className="input md:col-span-2" placeholder="くじの名前（例: 播州極上ラメくじ）" />
          <input name="slug" required pattern="[a-z0-9-]{2,40}" className="input" placeholder="URL名（英小文字・数字・-）" />
          <input name="price_yen" type="number" min={100} step={100} required className="input" placeholder="1口の価格（円）" />
          <input name="total" type="number" min={1} max={1000} required className="input" placeholder="総口数" />
          <button className="btn">作成</button>
          <input name="subtitle" className="input md:col-span-6" placeholder="ひとこと（例: 限定30口・目玉は当店自慢のラメ系）" />
        </form>
      </section>

      {/* くじ一覧 */}
      {pkgs.map((p) => {
        const sum = prizeTotal(p.id);
        return (
          <section key={p.id} className={`card p-4 ${p.status === "closed" ? "opacity-70" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold text-accent-2">{p.name} <span className="text-xs text-muted font-normal">/{p.slug} ・ 1口 {yen(p.price_yen)} ・ 総口数 {p.total} ・ 残り {p.remaining}口</span></h2>
              <div className="flex items-center gap-2">
                {p.sellable ? <span className="badge badge-ok">販売中</span> : <span className="badge badge-hot">{p.status === "closed" ? "停止中" : `準備中（賞の本数 ${sum}/${p.total}）`}</span>}
                <form action={oripaPackageStatusAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value={p.status === "open" ? "closed" : "open"} /><button className="btn btn-outline !py-1 text-xs">{p.status === "open" ? "停止" : "再開"}</button></form>
              </div>
            </div>
            {sum !== p.total && <p className="text-xs text-danger mt-1">賞の本数の合計（{sum}）が総口数（{p.total}）と一致するまで販売されません。</p>}
            <table className="w-full text-sm mt-2">
              <tbody className="divide-y divide-accent/10">
                {p.prizes.map((z) => (
                  <tr key={z.id}>
                    <td className="py-1.5 whitespace-nowrap font-bold">{RARITY_LABEL[z.rarity]}</td>
                    <td className="py-1.5">{z.name} <span className="text-xs text-muted">{KIND_LABEL[z.kind]} ・ 参考 {yen(z.ref_price)}{z.image_url ? " ・ 画像あり" : ""}</span></td>
                    <td className="py-1.5 text-right tnum whitespace-nowrap">残 {z.count_left}/{z.count_total}本</td>
                    <td className="py-1.5 text-right">
                      {z.count_left === z.count_total && <form action={deleteOripaPrizeAction}><input type="hidden" name="id" value={z.id} /><input type="hidden" name="package_id" value={p.id} /><button className="text-xs text-muted underline">削除</button></form>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form action={addOripaPrizeAction} className="grid gap-2 md:grid-cols-7 text-sm mt-3">
              <input type="hidden" name="package_id" value={p.id} />
              <select name="rarity" className="input" defaultValue="C"><option value="S">S賞</option><option value="A">A賞</option><option value="B">B賞</option><option value="C">C賞</option></select>
              <input name="name" required className="input md:col-span-2" placeholder="賞品名（実在の個体・商品）" />
              <select name="kind" className="input" defaultValue="medaka"><option value="medaka">メダカ（生体）</option><option value="goods">用品</option><option value="card">カード</option></select>
              <input name="ref_price" type="number" min={0} step={100} className="input" placeholder="参考価格（円）" />
              <input name="count" type="number" min={1} required className="input" placeholder="本数" />
              <button className="btn">賞を追加</button>
              <label className="md:col-span-4 flex items-center gap-2 text-xs text-muted">実物写真（JPEG/PNG/WebP・8MBまで。本番では必ず添付）<input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="input" /></label>
              <input name="image_url" className="input md:col-span-3" placeholder="または画像URL（任意）" />
            </form>
          </section>
        );
      })}
    </div>
  );
}
