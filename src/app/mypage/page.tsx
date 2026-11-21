import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { finalizeEnded, followedSellers, myBids, myFavorites, myLostBids, myNotifications, myWins } from "@/lib/auctions";
import Link from "next/link";
import ListingCard from "@/components/ListingCard";
import Countdown from "@/components/Countdown";
import { siteConfig } from "@/lib/config";
import { formatDateTime, yen } from "@/lib/format";
import { linkLineAction, logoutAction, markReadAction, updateProfileAction } from "./actions";

export const metadata: Metadata = { title: "マイページ" };
export const dynamic = "force-dynamic";

export default async function MyPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mypage");
  const sp = await searchParams;
  await finalizeEnded();
  const bids = myBids(user.id);
  const wins = myWins(user.id);
  const follows = followedSellers(user.id);
  const notes = myNotifications(user.id);
  const lost = myLostBids(user.id);
  const favs = myFavorites(user.id);
  const STATUS = { pending: ["承認待ち", "badge-hot"], approved: ["承認済み", "badge-ok"], blocked: ["停止中", ""] } as const;
  const unread = notes.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-accent-2">マイページ</h1>
        <form action={logoutAction}><button className="btn btn-outline !py-1">ログアウト</button></form>
      </div>
      <p className="text-sm text-muted">
        ログイン中：{user.email}
        {user.role === "admin" && <span className="badge badge-star ml-2">管理者</span>}
        <span className={`badge ml-2 ${STATUS[user.status][1]}`}>{STATUS[user.status][0]}</span>
        {user.shop_name && <span className="ml-2">{user.shop_name}</span>}
        <Link href="/register?next=/mypage" className="ml-2 underline text-xs">登録情報の変更</Link>
      </p>
      {user.status === "pending" && user.role !== "admin" && (
        <p className="text-sm border border-accent/30 rounded p-2">会員登録の承認待ちです。承認されるとお知らせが届き、入札できるようになります。</p>
      )}
      {sp.saved && <p className="text-ok text-sm border border-ok/40 rounded p-2">保存しました。</p>}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-4 space-y-3">
          <h2 className="font-bold text-accent-2">📍 発送先情報</h2>
          <p className="text-xs text-muted">落札時の発送に使用します。入札前に登録してください。</p>
          <form action={updateProfileAction} className="space-y-2 text-sm">
            <label className="block">表示名（入札履歴に表示）<input name="name" className="input mt-1" defaultValue={user.name ?? ""} placeholder="例: 播州太郎" /></label>
            <label className="block">お名前<input name="shipping_name" className="input mt-1" defaultValue={user.shipping_name ?? ""} /></label>
            <label className="block">郵便番号<input name="shipping_postal" className="input mt-1" defaultValue={user.shipping_postal ?? ""} placeholder="670-0000" /></label>
            <label className="block">住所<input name="shipping_address" className="input mt-1" defaultValue={user.shipping_address ?? ""} /></label>
            <label className="block">電話番号<input name="shipping_phone" className="input mt-1" defaultValue={user.shipping_phone ?? ""} /></label>
            <button className="btn w-full">保存</button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <h2 className="font-bold text-accent-2">🔔 LINE通知の設定</h2>
            {user.line_user_id ? (
              <p className="text-sm text-ok">LINE連携済み。高値更新・落札・フォロー出品者の新規出品を通知します。</p>
            ) : (
              <ol className="text-sm text-muted list-decimal pl-5 space-y-1">
                <li>{siteConfig.line.addFriendUrl ? <a className="text-line underline" href={siteConfig.line.addFriendUrl} target="_blank" rel="noreferrer">公式LINEを友だち追加</a> : "公式LINEを友だち追加"}</li>
                <li>LINEで「連携」と送信すると、連携コード（ユーザーID）が返信されます</li>
                <li>下の欄に貼り付けて保存</li>
              </ol>
            )}
            <form action={linkLineAction} className="flex gap-2">
              <input name="line_user_id" className="input" defaultValue={user.line_user_id ?? ""} placeholder="LINE連携コード" />
              <button className="btn btn-line whitespace-nowrap">{user.line_user_id ? "更新" : "連携する"}</button>
            </form>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-accent-2">お知らせ {unread > 0 && <span className="badge badge-hot">{unread}</span>}</h2>
              {unread > 0 && <form action={markReadAction}><button className="text-xs text-muted underline">すべて既読</button></form>}
            </div>
            {notes.length === 0 ? <p className="text-sm text-muted">お知らせはありません。</p> : (
              <ul className="text-sm divide-y divide-accent/10 max-h-64 overflow-auto">
                {notes.map((n) => (
                  <li key={n.id} className={`py-2 ${n.read ? "text-muted" : ""}`}>
                    {n.listing_id ? <Link href={`/auctions/${n.listing_id}`} className="hover:text-accent-2">{n.message}</Link> : n.message}
                    <div className="text-xs text-muted">{formatDateTime(n.created_at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-bold text-accent-2 mb-2">♡ お気に入り（{favs.length}）</h2>
        {favs.length === 0 ? <p className="text-sm text-muted card p-4">出品カードの♡からお気に入りに登録できます。</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{favs.map((l) => <ListingCard key={l.id} l={l} fav back="/mypage" />)}</div>
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-bold text-accent-2 mb-2">🏆 落札品</h2>
        {wins.length === 0 ? <p className="text-sm text-muted">まだ落札品はありません。</p> : (
          <div className="text-sm space-y-2">
            <p className="text-xs text-muted">お支払い：{siteConfig.payment.method}（落札後{siteConfig.payment.dueDays}日以内）。{siteConfig.payment.bankInfo}</p>
            <table className="w-full">
              <tbody className="divide-y divide-accent/10">
                {wins.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2"><Link href={`/auctions/${l.id}`} className="hover:text-accent-2">{l.title}</Link><div className="text-xs text-muted">{l.seller_name}</div></td>
                    <td className="py-2 text-right font-bold whitespace-nowrap">{yen(l.current_price)}</td>
                    <td className="py-2 text-right text-xs text-muted whitespace-nowrap">{formatDateTime(l.ends_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-bold text-accent-2 mb-2">入札中・入札履歴</h2>
        {bids.length === 0 ? <p className="text-sm text-muted">入札履歴はありません。</p> : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-accent/10">
              {bids.map((l) => {
                const leading = l.status === "open" && l.leader_id === user.id;
                return (
                  <tr key={l.id}>
                    <td className="py-2"><Link href={`/auctions/${l.id}`} className="hover:text-accent-2">{l.title}</Link></td>
                    <td className="py-2 text-right whitespace-nowrap">上限 {yen(l.my_max)}<div className="text-xs text-muted">現在 {yen(l.current_price)}{l.status === "open" && <> ・ <Countdown endsAt={l.ends_at} fallback="" /></>}</div></td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {l.status === "open" ? (leading ? <span className="badge badge-ok">最高額</span> : <span className="badge badge-hot">高値更新あり</span>)
                        : l.winner_id === user.id ? <span className="badge badge-star">落札</span> : <span className="badge">終了</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-bold text-accent-2 mb-2">競り負け履歴</h2>
        <p className="text-xs text-muted mb-2">入札したのに履歴に載らない場合はここに出ます。他の方の上限の方が高く、その場で負けた入札です。同じ出品者の次回出品でリベンジしましょう。</p>
        {lost.length === 0 ? <p className="text-sm text-muted">競り負けはありません。</p> : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-accent/10">
              {lost.map((x) => (
                <tr key={x.id}>
                  <td className="py-2"><Link href={`/auctions/${x.listing_id}`} className="hover:text-accent-2">{x.title}</Link><div className="text-xs text-muted">{x.seller_name} ・ {formatDateTime(x.created_at)}</div></td>
                  <td className="py-2 text-right whitespace-nowrap">自分の上限 {yen(x.amount)}<div className="text-xs text-muted">負けた時点の価格 {yen(x.price_after)}</div></td>
                  <td className="py-2 text-right whitespace-nowrap">{x.status === "open" ? <Link href={`/auctions/${x.listing_id}`} className="btn !py-1 text-xs">再挑戦</Link> : <span className="badge">終了</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-bold text-accent-2 mb-2">★ フォロー中の出品者</h2>
        {follows.length === 0 ? <p className="text-sm text-muted">出品者ページの☆からフォローできます。</p> : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {follows.map((s) => <li key={s.id}><Link href={`/sellers/${s.slug}`} className="badge badge-star hover:brightness-110">★ {s.name}</Link></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
