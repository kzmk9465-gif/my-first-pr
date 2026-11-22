import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { finalizeEnded, followedSellers, myBids, myFavorites, myLostBids, myNotifications, myWins } from "@/lib/auctions";
import Link from "next/link";
import ListingCard from "@/components/ListingCard";
import MyTabs, { type TabDef } from "@/components/MyTabs";
import { siteConfig } from "@/lib/config";
import { formatDateTime, formatShort, remaining, yen } from "@/lib/format";
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

const HOUR = 60 * 60_000;

export default async function MyPage({ searchParams }: { searchParams: Promise<{ tab?: string; saved?: string; received?: string; bonus?: string; gacha?: string; won?: string; gacha_error?: string; pay_error?: string; pay_cancelled?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mypage");
  const sp = await searchParams;
  await finalizeEnded();
  const bids = myBids(user.id);
  const activeBids = bids.filter((b) => b.status === "open");
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
  const unread = notes.filter((n) => !n.read).length;
  const outbidCount = activeBids.filter((b) => b.leader_id !== user.id).length;
  const verified = user.status === "approved" || user.role === "admin";
  const nickname = user.name?.trim() || "播州メダカ愛好家";
  const hasAddress = Boolean(user.shipping_address);

  /* ───────── タブ①：入札中 ───────── */
  const activeNode = activeBids.length === 0 ? (
    <p className="text-sm text-muted rounded-2xl border border-white/10 bg-[#182234] p-5 text-center">
      いま入札中のロットはありません。<Link href="/auctions" className="text-accent-2 underline ml-1">会場で探す</Link>
    </p>
  ) : (
    <div className="space-y-3">
      {outbidCount > 0 && (
        <p className="text-sm font-bold rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 px-3 py-2">
          ⚡ {outbidCount} 件が高値更新されています。今すぐ競り返しましょう。
        </p>
      )}
      {activeBids.map((l) => {
        const leading = l.leader_id === user.id;
        const soon = new Date(l.ends_at).getTime() - Date.now() < HOUR;
        return (
          <article key={l.id} className="rounded-2xl border border-white/10 bg-[#182234] p-3 flex gap-3">
            <Link href={`/auctions/${l.id}`} className="shrink-0">
              <div className="h-20 w-20 rounded-xl overflow-hidden bg-surface-2 border border-white/10 flex items-center justify-center">
                {l.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.image_url} alt={l.mystery ? "千両箱" : l.title} className="h-full w-full object-cover" style={l.mystery ? { filter: "brightness(0) blur(2px)", opacity: 0.85 } : undefined} />
                ) : (
                  <span className="text-[10px] text-muted">画像なし</span>
                )}
              </div>
            </Link>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Link href={`/auctions/${l.id}`} className="block font-bold text-sm leading-snug line-clamp-2 hover:text-accent-2">{l.title}</Link>
              <div>
                {leading ? (
                  <span className="inline-flex items-center bg-sky-500/20 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded-full text-xs font-bold">🏆 あなたが最高入札者</span>
                ) : (
                  <span className="inline-flex items-center bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full text-xs font-bold animate-pulse">⚡ 高値更新されました！</span>
                )}
              </div>
              <div className="flex items-end justify-between gap-2">
                <div className="text-[11px] text-muted leading-tight">
                  現在の最高額
                  <div className={`font-mono tabular-nums text-lg font-bold ${leading ? "text-accent-2" : "text-rose-400"}`}>{yen(l.current_price)}</div>
                </div>
                <div className="text-[11px] text-muted leading-tight text-right">
                  あなたの上限
                  <div className="font-mono tabular-nums text-base text-foreground">{yen(l.my_max)}</div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-0.5">
                {soon ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono tabular-nums text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">{remaining(l.ends_at)}</span>
                ) : (
                  <span className="text-xs text-muted font-mono tabular-nums">{remaining(l.ends_at)}</span>
                )}
                {!leading && (
                  <Link href={`/auctions/${l.id}#bid`} className="btn !py-1.5 px-4 text-sm whitespace-nowrap">今すぐ再入札する</Link>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );

  /* ───────── タブ②：落札分 ───────── */
  const wonNode = orders.length === 0 ? (
    <p className="text-sm text-muted rounded-2xl border border-white/10 bg-[#182234] p-5 text-center">
      落札が確定すると、ここでお支払い・発送状況を管理できます。
    </p>
  ) : (
    <div className="space-y-3">
      {orders.map((o) => {
        const total = o.price + o.shipping_fee;
        const badgeClass = o.status === "cancelled" ? "bg-white/10 text-muted border-white/15" : o.status === "completed" ? "bg-sky-500/20 text-sky-400 border-sky-500/30" : o.status === "awaiting_payment" ? "bg-rose-500/20 text-rose-400 border-rose-500/30" : "bg-accent/15 text-accent-2 border-accent/30";
        return (
          <article key={o.listing_id} className="rounded-2xl border border-white/10 bg-[#182234] p-3 space-y-2.5">
            <div className="flex gap-3">
              <Link href={`/auctions/${o.listing_id}`} className="shrink-0">
                <div className="h-16 w-16 rounded-xl overflow-hidden bg-surface-2 border border-white/10 flex items-center justify-center">
                  {o.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.image_url} alt={o.title} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-muted">画像なし</span>
                  )}
                </div>
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/auctions/${o.listing_id}`} className="font-bold text-sm leading-snug line-clamp-2 hover:text-accent-2">{o.title}</Link>
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${badgeClass}`}>{ORDER_STATUS_LABELS[o.status]}</span>
                </div>
                <div className="text-xs text-muted mt-0.5">出品 {o.seller_name} ・ <span className="font-mono tabular-nums">{formatShort(o.created_at)}</span> 落札</div>
              </div>
            </div>

            <div className="rounded-xl bg-[#101726] border border-white/5 px-3 py-2 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted">落札価格</span><span className="font-mono tabular-nums">{yen(o.price)}</span></div>
              <div className="flex justify-between"><span className="text-muted">送料（{o.shipping_method === "cool" ? "クール便" : "常温便"}）</span><span className="font-mono tabular-nums">{yen(o.shipping_fee)}</span></div>
              <div className="flex justify-between border-t border-white/10 pt-1 mt-1"><span className="font-bold">お支払い合計</span><span className="font-mono tabular-nums font-bold text-accent-2 text-sm">{yen(total)}</span></div>
            </div>

            {o.status === "awaiting_payment" && (
              <div className="space-y-2">
                {o.seller_accepts_online ? (
                  <form action={startPaymentAction}>
                    <input type="hidden" name="listing_id" value={o.listing_id} />
                    <button className="btn w-full !py-2 text-sm">💳 決済へ進む（<span className="font-mono tabular-nums">{yen(total)}</span>）</button>
                    <p className="text-[11px] text-muted mt-1 text-center">カード・PayPay。{paymentProvider() === "mock" ? "※現在はテスト決済モードです。" : "決済画面へ移動します。"}</p>
                  </form>
                ) : null}
                <div className="text-[11px] text-muted border border-white/10 rounded-lg p-2 whitespace-pre-wrap leading-relaxed">
                  <b className="text-foreground">お支払い方法：</b>{o.seller_accepts_online ? "上の「決済へ進む」か、" : ""}{o.seller_payment_info || `${siteConfig.payment.method}。${siteConfig.payment.bankInfo}`}
                  {"\n"}落札後{siteConfig.payment.dueDays}日以内にお支払いください。
                  {"\n"}発送先：{hasAddress ? `〒${user.shipping_postal} ${user.shipping_address}` : "未登録"}
                  {!hasAddress && <Link href="#account" className="text-rose-400 underline ml-1">発送先を登録</Link>}
                </div>
              </div>
            )}

            {o.status === "paid" && (
              <div className="text-xs border border-white/10 rounded-lg p-2 space-y-1">
                <div className="font-bold text-accent-2">📦 発送準備中</div>
                <p className="text-muted">出品者が発送手配を進めています。生体便のため、天候・気温により発送日が調整される場合があります。</p>
                <div className="text-muted">お届け先：{hasAddress ? `〒${user.shipping_postal} ${user.shipping_address}` : <Link href="#account" className="text-rose-400 underline">発送先を登録してください</Link>}</div>
              </div>
            )}

            {o.status === "shipped" && (
              <div className="text-xs border border-white/10 rounded-lg p-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-accent-2">🚚 発送完了（{o.carrier || "ヤマト運輸 生体便"}）</span>
                  {o.tracking_no && <span className="font-mono tabular-nums text-foreground">追跡 {o.tracking_no}</span>}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/auctions/${o.listing_id}`} className="text-rose-400 underline">死着補償の申請（受け取り当日のみ）</Link>
                  <form action={completeOrderAction}><input type="hidden" name="listing_id" value={o.listing_id} /><button className="btn btn-outline !py-1 text-xs">受け取りました</button></form>
                </div>
              </div>
            )}

            {o.status === "completed" && <p className="text-xs text-sky-400">✓ お受け取り完了。ありがとうございました。</p>}
          </article>
        );
      })}
    </div>
  );

  /* ───────── タブ③：お気に入り ───────── */
  const watchNode = favs.length === 0 ? (
    <p className="text-sm text-muted rounded-2xl border border-white/10 bg-[#182234] p-5 text-center">
      出品カードの♡からお気に入りに登録できます。
    </p>
  ) : (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {favs.map((l) => {
        const ended = l.status === "ended" || l.status === "cancelled";
        return (
          <div key={l.id} className={ended ? "opacity-55 saturate-50" : ""}>
            <ListingCard l={l} fav back="/mypage" />
          </div>
        );
      })}
    </div>
  );

  const tabs: TabDef[] = [
    { key: "active", label: "入札中", count: activeBids.length, node: activeNode },
    { key: "won", label: "落札分", count: orders.length, node: wonNode },
    { key: "watch", label: "お気に入り", count: favs.length, node: watchNode },
  ];

  return (
    <div className="space-y-6">
      {/* 会員ヘッダー */}
      <section className="rounded-2xl border border-white/10 bg-[#182234] p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-accent-2 truncate">{nickname}</h1>
              {verified ? (
                <span className="inline-flex items-center bg-sky-500/20 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded-full text-xs font-bold">本人確認済 ✓</span>
              ) : (
                <span className="inline-flex items-center bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full text-xs font-bold">承認待ち</span>
              )}
              {user.role === "admin" && <span className="badge badge-star">管理者</span>}
            </div>
            <div className="text-xs text-muted mt-1">会員ID <span className="font-mono tabular-nums">#{String(user.id).padStart(5, "0")}</span> ・ {user.email}</div>
          </div>
          <form action={logoutAction}><button className="btn btn-outline !py-1 text-xs whitespace-nowrap">ログアウト</button></form>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-[#101726] border border-white/5 px-3 py-2">
          <div className="text-xs">
            <span className="text-muted">会員ランク </span>
            <span className="font-bold text-accent-2">{rank.rank.name}</span>
            <span className="text-muted"> ・ 累計落札 <span className="font-mono tabular-nums">{yen(rank.total)}</span></span>
          </div>
          <div className="text-[11px] text-muted text-right hidden sm:block">
            {rank.next ? <>次「{rank.next.name}」まで <span className="font-mono tabular-nums">{yen(rank.toNext)}</span></> : "最高ランク"}
          </div>
        </div>
      </section>

      {/* LINE連携バナー */}
      {user.line_user_id ? (
        <div className="flex items-center gap-2 text-sm rounded-xl border border-line/30 bg-line/5 px-3 py-2">
          <span className="inline-flex items-center gap-1 text-line font-bold">LINE通知: オン ✓</span>
          <span className="text-muted text-xs">高値更新・終了10分前・落札をリアルタイム通知</span>
        </div>
      ) : (
        <Link href={lineLoginEnabled() ? "/api/line/login?link=1&next=/mypage" : "#account"} className="block rounded-2xl border border-line/40 bg-gradient-to-r from-line/15 to-transparent px-4 py-3 hover:brightness-110 transition">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div className="min-w-0">
              <div className="font-bold text-sm text-foreground">LINE連携して通知を受け取る</div>
              <div className="text-xs text-muted">高値更新・終了10分前をリアルタイムでお知らせ。競り負けを防げます。</div>
            </div>
            <span className="ml-auto shrink-0 btn btn-line !py-1.5 px-3 text-xs">連携する</span>
          </div>
        </Link>
      )}

      {/* フラッシュメッセージ */}
      {sp.saved && <p className="text-ok text-sm border border-ok/40 rounded p-2">保存しました。</p>}
      {sp.received && <p className="text-ok text-sm border border-ok/40 rounded p-2">お受け取りありがとうございました。</p>}
      {sp.pay_error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.pay_error}</p>}
      {sp.pay_cancelled && <p className="text-muted text-sm border border-accent/20 rounded p-2">お支払いはキャンセルされました。取引はそのまま残っています。</p>}

      {/* 3大タブ */}
      <MyTabs tabs={tabs} initial={sp.tab} />

      {user.status === "pending" && user.role !== "admin" && (
        <p className="text-sm border border-accent/30 rounded p-2">会員登録の承認待ちです。承認されるとお知らせが届き、入札できるようになります。</p>
      )}

      {sellerAcc && (
        <p className="text-sm border border-accent/30 rounded p-3 flex flex-wrap items-center justify-between gap-2">
          <span>出品者アカウント「{sellerAcc.name}」が有効です。</span>
          <Link href="/sell/dashboard" className="btn !py-1">出品者ダッシュボードへ</Link>
        </p>
      )}

      {/* ───── アカウント・設定 ───── */}
      <div id="account" className="pt-2">
        <div className="flex items-center gap-3 mb-3">
          <div className="hairline flex-1" />
          <span className="text-xs text-muted font-bold">アカウント・設定</span>
          <div className="hairline flex-1" />
        </div>

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

        <section className="card p-4 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-accent-2">🎰 ガチャ <span className="text-xs text-muted font-normal">ログインボーナスを貯めて回そう</span></h2>
            <div className="text-sm">保有 <b className="text-accent-2 text-lg font-mono tabular-nums">{pts}</b> ポイント</div>
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

        <section className="card p-4 mt-4" id="certs">
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

        <section className="card p-4 mt-4">
          <h2 className="font-bold text-accent-2 mb-2">⚔ 競り負け履歴</h2>
          <p className="text-xs text-muted mb-2">他の方の上限の方が高く、その場で負けた入札です。同じ出品者の次回出品でリベンジしましょう。</p>
          {lost.length === 0 ? <p className="text-sm text-muted">競り負けはありません。</p> : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-accent/10">
                {lost.map((x) => (
                  <tr key={x.id}>
                    <td className="py-2"><Link href={`/auctions/${x.listing_id}`} className="hover:text-accent-2">{x.title}</Link><div className="text-xs text-muted">{x.seller_name} ・ <span className="font-mono tabular-nums">{formatDateTime(x.created_at)}</span></div></td>
                    <td className="py-2 text-right whitespace-nowrap">自分の上限 <span className="font-mono tabular-nums">{yen(x.amount)}</span><div className="text-xs text-muted">負けた時点 <span className="font-mono tabular-nums">{yen(x.price_after)}</span></div></td>
                    <td className="py-2 text-right whitespace-nowrap">{x.status === "open" ? <Link href={`/auctions/${x.listing_id}`} className="btn !py-1 text-xs">再挑戦</Link> : <span className="badge">終了</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card p-4 mt-4">
          <h2 className="font-bold text-accent-2 mb-2">★ フォロー中の出品者</h2>
          {follows.length === 0 ? <p className="text-sm text-muted">出品者ページの☆からフォローできます。</p> : (
            <ul className="flex flex-wrap gap-2 text-sm">
              {follows.map((s) => <li key={s.id}><Link href={`/sellers/${s.slug}`} className="badge badge-star hover:brightness-110">★ {s.name}</Link></li>)}
            </ul>
          )}
        </section>

        {wins.length > 0 && (
          <p className="text-xs text-muted mt-4 text-center">これまでの落札 <span className="font-mono tabular-nums">{wins.length}</span> 件 ・ 累計 <span className="font-mono tabular-nums">{yen(wins.reduce((a, l) => a + l.current_price, 0))}</span></p>
        )}
      </div>
    </div>
  );
}
