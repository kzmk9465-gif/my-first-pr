import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { finalizeEnded, followedSellers, myBids, myFavorites, myLostBids, myNotifications, myWins } from "@/lib/auctions";
import Link from "next/link";
import ListingCard from "@/components/ListingCard";
import Countdown from "@/components/Countdown";
import { siteConfig } from "@/lib/config";
import { formatDateTime, yen } from "@/lib/format";
import { completeOrderAction, gachaAction, linkLineAction, loginBonusAction, logoutAction, markReadAction, startPaymentAction, updateProfileAction } from "./actions";
import { paymentProvider } from "@/lib/payments";
import { GACHA_COST, bonusClaimedToday, myResults, points } from "@/lib/gacha";
import { lineLoginEnabled } from "@/lib/line-login";
import { ordersForBuyer } from "@/lib/sellers";
import { ORDER_STATUS_LABELS } from "@/lib/config";
import { getSellerForUser } from "@/lib/sellers";
import { userRank } from "@/lib/ranks";
import { myCertificates } from "@/lib/certificates";

export const metadata: Metadata = { title: "マイページ" };
export const dynamic = "force-dynamic";

export default async function MyPage({ searchParams }: { searchParams: Promise<{ saved?: string; received?: string; bonus?: string; gacha?: string; won?: string; gacha_error?: string; pay_error?: string; pay_cancelled?: string }> }) {
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
  const orders = ordersForBuyer(user.id);
  const sellerAcc = getSellerForUser(user.id);
  const rank = userRank(user.id);
  const certs = myCertificates(user.id);
  const pts = points(user.id);
  const claimed = bonusClaimedToday(user.id);
  const gachaLog = myResults(user.id, 5);
  const STEPS: { key: string; label: string }[] = [
    { key: "awaiting_payment", label: "お手続き・お支払い" },
    { key: "paid", label: "入金の確認" },
    { key: "shipped", label: "発送" },
    { key: "completed", label: "お受け取り" },
  ];
  const stepIndex = (s: string) => (s === "cancelled" ? -1 : STEPS.findIndex((x) => x.key === s));
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
      {sp.received && <p className="text-ok text-sm border border-ok/40 rounded p-2">お受け取りありがとうございました。</p>}
      {sp.pay_error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.pay_error}</p>}
      {sp.pay_cancelled && <p className="text-muted text-sm border border-accent/20 rounded p-2">お支払いはキャンセルされました。取引はそのまま残っています。</p>}

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
            {lineLoginEnabled() && !user.line_user_id && <a href="/api/line/login?link=1&next=/mypage" className="btn btn-line w-full">LINEアカウントで連携する（かんたん）</a>}
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

      <section className="card p-4 text-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-muted">会員ランク</div>
          <div className="text-xl font-black text-accent-2">{rank.rank.name} <span className="text-xs text-muted font-normal">累計落札 {yen(rank.total)}</span></div>
        </div>
        <div className="text-xs text-muted">
          {rank.next ? <>次のランク「{rank.next.name}」まであと {yen(rank.toNext)}。ランクが上がると🌑闇市などの限定オークションに参加できます。</> : "最高ランクです。すべての闇市に参加できます。"}
        </div>
      </section>

      {sellerAcc && (
        <p className="text-sm border border-accent/30 rounded p-3 flex flex-wrap items-center justify-between gap-2">
          <span>出品者アカウント「{sellerAcc.name}」が有効です。</span>
          <Link href="/sell/dashboard" className="btn !py-1">出品者ダッシュボードへ</Link>
        </p>
      )}

      <section className="card p-4" id="orders">
        <h2 className="font-bold text-accent-2 mb-2">わたしの取引のいま</h2>
        {orders.length === 0 ? <p className="text-sm text-muted">落札するとここに手続きの進み具合が表示されます。</p> : (
          <div className="space-y-3">
            {orders.map((o) => {
              const idx = stepIndex(o.status);
              return (
                <div key={o.listing_id} className="border border-accent/10 rounded p-3 text-sm space-y-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div className="font-bold"><Link href={`/auctions/${o.listing_id}`} className="hover:text-accent-2">{o.title}</Link><div className="text-xs text-muted font-normal">出品者 {o.seller_name} ・ {formatDateTime(o.created_at)} 落札</div></div>
                    <span className={`badge ${o.status === "cancelled" ? "" : o.status === "completed" ? "badge-ok" : "badge-star"}`}>{ORDER_STATUS_LABELS[o.status]}</span>
                  </div>
                  <ol className="grid grid-cols-4 gap-1 text-[11px] text-center">
                    {STEPS.map((s, n) => (
                      <li key={s.key} className={`rounded py-1 border ${n < idx ? "border-ok/40 text-ok" : n === idx ? "border-accent text-accent-2 font-bold" : "border-accent/10 text-muted"}`}>{n < idx ? "✓ " : ""}{s.label}</li>
                    ))}
                  </ol>
                  <div className="text-xs">
                    落札 {yen(o.price)} ＋ 送料 {yen(o.shipping_fee)}（{o.shipping_method === "cool" ? "クール便" : "常温便"}） ＝ <b>お支払い合計 {yen(o.price + o.shipping_fee)}</b>
                  </div>
                  {o.status === "awaiting_payment" && (
                    <div className="space-y-2">
                      {o.seller_accepts_online ? (
                        <form action={startPaymentAction} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="listing_id" value={o.listing_id} />
                          <button className="btn !py-1 text-sm">💳 オンラインで支払う（{yen(o.price + o.shipping_fee)}）</button>
                          <span className="text-xs text-muted">カード・PayPay。{paymentProvider() === "mock" ? "※現在はテスト決済モードです。" : "決済画面へ移動します。"}</span>
                        </form>
                      ) : null}
                      <div className="text-xs border border-accent/20 rounded p-2 whitespace-pre-wrap">
                        <b>お支払い方法：</b>{o.seller_accepts_online ? "上の「オンラインで支払う」か、" : ""}{o.seller_payment_info || `${siteConfig.payment.method}。${siteConfig.payment.bankInfo}`}
                        {"\n"}落札後{siteConfig.payment.dueDays}日以内にお支払いください。発送先：{user.shipping_address ? `〒${user.shipping_postal} ${user.shipping_address}` : <span className="text-danger">未登録（上の発送先情報を保存してください）</span>}
                      </div>
                    </div>
                  )}
                  {o.status === "shipped" && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span>発送済み：{o.carrier} {o.tracking_no}</span>
                      <form action={completeOrderAction}><input type="hidden" name="listing_id" value={o.listing_id} /><button className="btn !py-1 text-xs">受け取りました</button></form>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-bold text-accent-2 mb-2">🏆 落札品</h2>
        {wins.length === 0 ? <p className="text-sm text-muted">まだ落札品はありません。</p> : (
          <div className="text-sm space-y-2">
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-accent-2">🎰 ガチャ <span className="text-xs text-muted font-normal">ログインボーナスを貯めて回そう</span></h2>
          <div className="text-sm">保有 <b className="text-accent-2 text-lg">{pts}</b> ポイント</div>
        </div>
        {sp.bonus === "1" && <p className="text-ok text-sm border border-ok/40 rounded p-2 mt-2">本日のログインボーナス +1 ポイント！</p>}
        {sp.bonus === "0" && <p className="text-muted text-sm border border-accent/20 rounded p-2 mt-2">本日のボーナスは受け取り済みです。また明日！</p>}
        {sp.gacha_error && <p className="text-danger text-sm border border-danger/40 rounded p-2 mt-2">{sp.gacha_error}</p>}
        {sp.gacha && (sp.won === "1" ? <p className="text-ok text-sm border border-ok/40 rounded p-2 mt-2 font-bold">🎉 当たり！「{sp.gacha}」。お店から景品についてご連絡します。</p> : <p className="text-muted text-sm border border-accent/20 rounded p-2 mt-2">残念、はずれ…。また挑戦！</p>)}
        <div className="flex flex-wrap gap-2 mt-3">
          <form action={loginBonusAction}><button className="btn btn-outline" disabled={claimed}>{claimed ? "✓ 本日のボーナス受取済み" : "本日のログインボーナスを受け取る（+1）"}</button></form>
          <form action={gachaAction}><button className="btn" disabled={pts < GACHA_COST}>ガチャを回す（{GACHA_COST}ポイント）</button></form>
        </div>
        {gachaLog.length > 0 && <ul className="text-xs text-muted mt-2 flex flex-wrap gap-x-4">{gachaLog.map((g) => <li key={g.id}>{g.won ? "🎉" : "・"}{g.prize_name}（{formatDateTime(g.created_at)}）</li>)}</ul>}
      </section>

      <section className="card p-4" id="certs">
        <h2 className="font-bold text-accent-2 mb-2">📜 マイ証明一覧</h2>
        {certs.length === 0 ? <p className="text-sm text-muted">落札した個体の販売証明書は、ご入金確認後に出品ページから発行できます。</p> : (
          <ul className="text-sm divide-y divide-accent/10">
            {certs.map((c) => (
              <li key={c.id} className="py-2 flex flex-wrap justify-between gap-2">
                <span><Link href={`/certificates/${c.code}`} className="font-mono underline">{c.code}</Link> {c.title}</span>
                <span className={`badge ${c.status === "issued" ? "badge-ok" : c.status === "pending" ? "badge-hot" : ""}`}>{c.type === "sale" ? "落札販売証明" : "二次販売証明"}{c.status === "pending" ? "（確認待ち）" : c.status === "rejected" ? "（却下）" : ""}</span>
              </li>
            ))}
          </ul>
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
