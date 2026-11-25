import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { bidStatus, canRevealMystery, extensionSeconds, finalizeEnded, getBids, getListing, isFavorite, isFollowing, isUnlocked, listingImages, liveState, minimumBid } from "@/lib/auctions";
import { getSellerForUser, getOrder } from "@/lib/sellers";
import Gallery from "@/components/Gallery";
import LiveBoard from "@/components/LiveBoard";
import Danmaku from "@/components/Danmaku";
import BidBox from "@/components/BidBox";
import StickyBidBar from "@/components/StickyBidBar";
import ShareButton from "@/components/ShareButton";
import { canBid, getCurrentUser, needsRegistration } from "@/lib/auth";
import { CERTIFICATE_LABELS, siteConfig } from "@/lib/config";
import { formatDateTime, formatShort, yen } from "@/lib/format";
import { confirmBidAction, favoriteAction, followAction, issueCertificateAction, reportAction, unlockAction } from "./actions";
import { userRank, rankByLevel } from "@/lib/ranks";
import { certificateForListing } from "@/lib/certificates";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; bid?: string; outcome?: string; price?: string; extended?: string; bought?: string; unlocked?: string; reported?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = getListing(Number((await params).id));
  return { title: l ? l.title : "出品が見つかりません" };
}

export default async function ListingPage({ params, searchParams }: Props) {
  const id = Number((await params).id);
  const sp = await searchParams;
  await finalizeEnded();
  const l = getListing(id);
  if (!l) notFound();
  const user = await getCurrentUser();
  if (l.status === "review") {
    const mine = user ? getSellerForUser(user.id)?.id === l.seller_id : false;
    if (!user || (user.role !== "admin" && !mine)) notFound();
  }
  const mySellerId = user ? (getSellerForUser(user.id)?.id ?? null) : null;
  const reveal = canRevealMystery(l, user, mySellerId);
  const images = listingImages(l);
  const myRank = user ? userRank(user.id) : null;
  const rankOk = !l.min_rank || (user?.role === "admin") || (myRank ? myRank.rank.level >= l.min_rank : false);
  const unlocked = !l.passphrase_hash || (user ? user.role === "admin" || isUnlocked(user.id, l.id) : false);
  const order = l.status === "ended" && l.winner_id ? getOrder(l.id) : null;
  const live = liveState(l.id)!;
  const liveInit = { ...live, recent: live.recent.map((b) => ({ ...b })), duel: live.duel ? { ...live.duel } : null };
  const cert = l.status === "ended" ? certificateForListing(l.id) : null;
  const ytId = l.video_url?.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{6,})/)?.[1] ?? null;
  const canBuyout = !!l.buyout_price && l.status === "open" && l.current_price < l.buyout_price;
  const bids = getBids(id);
  const open = l.status === "open";
  const min = minimumBid(l);
  const top = bids[0];
  const st = bidStatus(id, user?.id);
  const iAmTop = !!user && st.leader_id === user.id;
  const iWon = !!user && l.winner_id === user.id;
  const following = user ? isFollowing(user.id, l.seller_id) : false;
  const fav = user ? isFavorite(user.id, l.id) : false;
  const back = `/auctions/${l.id}`;
  const needReg = !!user && needsRegistration(user);
  const allowed = !!user && canBid(user);
  const extMin = Math.round(extensionSeconds(l) / 60);
  const canBidHere = open && !!user && !needReg && allowed && rankOk && unlocked;

  const pills = (
    <div className="flex flex-wrap gap-1.5 items-center">
      {l.featured ? <span className="badge badge-star">⭐注目</span> : null}
      {l.hot ? <span className="badge badge-hot">🔥 白熱</span> : null}
      {l.status === "review" && <span className="badge badge-hot">確認待ち（非公開）</span>}
      {l.min_rank > 0 && <span className="badge badge-hot">🌑 闇市：{rankByLevel(l.min_rank).name}以上</span>}
      {l.passphrase_hash && <span className="badge badge-star">🔒 限定（合言葉）</span>}
      {l.mystery ? <span className="badge badge-star">📦 千両箱</span> : null}
      {l.status === "scheduled" && <span className="badge">開催前</span>}
      {l.status === "ended" && <span className="badge">終了</span>}
      {l.status === "cancelled" && <span className="badge">取消</span>}
      {l.certificate && <span className="badge badge-ok">{CERTIFICATE_LABELS[l.certificate]} ✓</span>}
    </div>
  );

  return (
    <div className="pb-24 lg:pb-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <Link href="/auctions" className="text-sm text-muted hover:text-accent-2">← 会場に戻る</Link>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted font-mono tabular-nums">ID: {l.id}</span>
          <form action={favoriteAction}>
            <input type="hidden" name="listing_id" value={l.id} />
            <input type="hidden" name="back" value={back} />
            <button aria-label={fav ? "お気に入り解除" : "お気に入り"} className={`h-9 w-9 rounded-full border bg-surface-2 text-sm transition ${fav ? "text-danger border-danger/50" : "text-muted border-white/15 hover:text-accent-2 hover:border-accent/50"}`}>{fav ? "♥" : "♡"}</button>
          </form>
          <ShareButton title={l.title} path={back} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] items-start">
        {/* 左：メディア・情報 */}
        <div className="space-y-4">
          <Gallery images={images} title={l.title} silhouette={!reveal} videoId={reveal ? ytId : null} />
          {l.mystery && !reveal ? <p className="text-xs text-muted text-center">📦 千両箱：中身は落札してからのお楽しみ。画像はシルエットで表示しています。</p> : null}

          <div className="space-y-2">
            {pills}
            <h1 className="text-xl md:text-2xl font-bold leading-snug text-foreground">{l.title}</h1>
            {l.subtitle && <p className="text-sm text-muted">{l.subtitle}</p>}
            <p className="text-sm text-muted">
              出品 <Link href={`/sellers/${l.seller_slug}`} className="text-accent-2 hover:underline">{l.seller_name}</Link>
              {l.breeder && <> ／ 作出 {l.breeder}</>}
            </p>
          </div>

          {/* 個体スペック表 */}
          <div className="rounded-2xl border border-white/10 p-4 text-sm" style={{ background: "#101726" }}>
            <h2 className="font-bold text-accent-2 mb-2">個体スペック</h2>
            <dl className="grid grid-cols-[6rem_1fr] gap-y-1.5">
              {l.variety && (<><dt className="text-muted">品種</dt><dd>{l.variety}</dd></>)}
              {l.quantity && (<><dt className="text-muted">数量</dt><dd>{l.quantity}</dd></>)}
              <dt className="text-muted">開始価格</dt><dd className="tnum">{yen(l.start_price)}</dd>
              {l.buyout_price && (<><dt className="text-muted">即決価格</dt><dd className="tnum">{yen(l.buyout_price)}</dd></>)}
              <dt className="text-muted">入札単位</dt><dd className="tnum">{yen(l.bid_increment)}</dd>
              <dt className="text-muted">開始</dt><dd className="tnum">{formatShort(l.starts_at)}</dd>
              <dt className="text-muted">終了</dt><dd className="tnum">{formatShort(l.ends_at)}{l.extended_count > 0 && <span className="text-muted text-xs ml-1">（{l.extended_count}回延長）</span>}</dd>
            </dl>
            {l.description && <p className="whitespace-pre-wrap pt-3 mt-2 border-t border-white/10">{l.description}</p>}
          </div>

          {/* 発送・補償アコーディオン */}
          <details className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: "#101726" }}>
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-accent-2">発送方法・送料／死着補償について</summary>
            <div className="px-4 pb-4 text-sm text-muted space-y-2">
              <p><b className="text-foreground">発送方法</b>：{l.shipping_method === "cool" ? "クール便" : "常温便"}（発泡スチロール＋酸素パッキング）。送料 {yen(l.shipping_fee)}（落札者負担）。生体の状態・気象により発送日を調整する場合があります。</p>
              <p><b className="text-foreground">死着補償</b>：到着後2時間以内に、開封前の状態がわかる写真を添えてご連絡ください。補償の有無・条件は各出品の説明欄に従います。</p>
              <p><b className="text-foreground">お支払い</b>：{siteConfig.payment.method}ほか。落札後{siteConfig.payment.dueDays}日以内。</p>
            </div>
          </details>

          {l.status !== "review" && <Danmaku listingId={l.id} canPost={!!user && allowed} enabled={!!l.comments_enabled} />}

          {user && l.status !== "review" && (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">⚖ 奉行所（管理者）へ通報する</summary>
              {sp.reported ? <p className="text-ok mt-2">通報を受け付けました。奉行所が確認します。</p> : (
                <form action={reportAction} className="mt-2 space-y-2">
                  <input type="hidden" name="listing_id" value={l.id} />
                  <textarea name="reason" rows={2} required className="input" placeholder="不審な点（画像の無断使用、説明と違う、価格操作の疑いなど）" />
                  <button className="btn btn-outline !py-1">通報する</button>
                </form>
              )}
            </details>
          )}
        </div>

        {/* 右：入札パネル（PCでは追従） */}
        <div className="space-y-4 lg:sticky lg:top-20" id="bid">
          <div className="card !bg-[#182234] p-5 space-y-3 shadow-xl">
            <LiveBoard listingId={l.id} initial={liveInit} open={open} myUserId={user?.id ?? null} />

            {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}
            {sp.unlocked && <p className="text-ok text-sm border border-ok/40 rounded p-2">🔓 合言葉を確認しました。入札できます。</p>}
            {sp.bought && <p className="text-ok text-sm border border-ok/40 rounded p-2">🏆 即決価格 {yen(Number(sp.bought))} で落札しました。<Link href="/mypage?tab=won" className="underline">マイページの「落札分」</Link>からお支払い手続きへ。</p>}
            {sp.bid && sp.outcome === "lost" && <p className="text-danger text-sm border border-danger/40 rounded p-2">上限 {yen(Number(sp.bid))} では他の方の上限に届きませんでした。価格は {yen(Number(sp.price))} になりました。もう一度、より高い上限で挑戦できます。</p>}
            {sp.bid && sp.outcome === "raised" && <p className="text-ok text-sm border border-ok/40 rounded p-2">上限額を {yen(Number(sp.bid))} に引き上げました。あなたが引き続き最高入札者です。</p>}
            {sp.bid && sp.outcome === "leading" && <p className="text-ok text-sm border border-ok/40 rounded p-2">🏆 上限 {yen(Number(sp.bid))} で入札し、現在 {yen(Number(sp.price))} であなたが最高入札者です。{sp.extended && "終了間際のため延長されました。"}</p>}

            {open ? (
              user ? needReg ? (
                <Link href={`/register?next=${encodeURIComponent(back)}`} className="btn w-full">会員登録して入札</Link>
              ) : !allowed ? (
                <p className="text-sm text-muted border border-accent/20 rounded p-2">{user.status === "blocked" ? "このアカウントは入札できません。" : "会員登録の承認待ちです。承認されると入札できます。"}</p>
              ) : !rankOk ? (
                <p className="text-sm text-muted border border-accent/20 rounded p-2">🌑 この出品は闇市です。会員ランク「{rankByLevel(l.min_rank).name}」以上の方のみ入札できます（あなたは「{myRank?.rank.name}」、累計 {yen(myRank?.total ?? 0)}）。</p>
              ) : !unlocked ? (
                <form action={unlockAction} className="space-y-2 border border-accent/30 rounded p-3">
                  <input type="hidden" name="listing_id" value={l.id} />
                  <p className="text-sm">🔒 限定オークションです。合言葉を入力してください。</p>
                  <input name="passphrase" required className="input" placeholder="合言葉" autoComplete="off" />
                  <button className="btn w-full">合言葉を送る</button>
                </form>
              ) : (
                <div className="space-y-2">
                  <BidBox listingId={l.id} base={min} increment={l.bid_increment} currentPrice={l.current_price} iAmTop={iAmTop} myMax={st.my_max ?? 0} />
                  {iAmTop ? (
                    <p className="text-xs text-ok">🏆 あなたが現在の最高入札者です（上限 {yen(st.my_max ?? 0)}）。上限を引き上げられます。</p>
                  ) : (
                    <p className="text-xs text-muted">「ここまでなら出せる」上限を入れると、他の方の入札に応じて自動で競り上がります（上限を超えることはありません）。</p>
                  )}
                  <p className="text-xs text-muted">※ 終了{Math.round(siteConfig.autoExtendWindowSeconds / 60)}分前の入札で{extMin}分間 自動延長されます{l.sudden_death ? "（サドンデス：回数ごとに短縮）" : ""}。</p>
                  {myRank && <p className="text-xs text-muted">あなたのランク：<b className="text-accent-2">{myRank.rank.name}</b>（累計 {yen(myRank.total)}）</p>}
                  {canBuyout && <Link href={`/auctions/${l.id}/buyout`} className="btn btn-outline w-full">即決 {yen(l.buyout_price!)} で落札する</Link>}
                </div>
              ) : (
                <Link href={`/login?next=${encodeURIComponent(back)}`} className="btn w-full">ログインして入札</Link>
              )
            ) : l.status === "ended" ? (
              <div className="text-sm">
                {top ? <p>落札者：<b>{iWon ? "あなた" : "***"}</b></p> : <p className="text-muted">入札はありませんでした。</p>}
                {iWon && (
                  <div className="mt-2 space-y-2">
                    <p className="text-ok">おめでとうございます。<Link href="/mypage?tab=won" className="underline">マイページの「落札分」</Link>からお支払い手続きへ。</p>
                    {cert ? (
                      <Link href={`/certificates/${cert.code}`} className="btn btn-outline w-full">📜 落札販売証明書を見る（{cert.code}）</Link>
                    ) : order && ["paid", "shipped", "completed"].includes(order.status) ? (
                      <form action={issueCertificateAction}><input type="hidden" name="listing_id" value={l.id} /><button className="btn w-full">📜 落札販売証明書を発行</button></form>
                    ) : (
                      <p className="text-xs text-muted">📜 落札販売証明書は、ご入金の確認後にここから発行できます。</p>
                    )}
                  </div>
                )}
              </div>
            ) : l.status === "scheduled" ? (
              <p className="text-sm text-muted">{formatDateTime(l.starts_at)} に開始します。</p>
            ) : null}
          </div>

          <div className="card p-4 flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="text-muted text-xs">出品者</div>
              <Link href={`/sellers/${l.seller_slug}`} className="font-bold text-accent-2 hover:underline">{l.seller_name}</Link>
            </div>
            <form action={followAction}>
              <input type="hidden" name="seller_id" value={l.seller_id} />
              <input type="hidden" name="back" value={back} />
              <button className={`btn ${following ? "" : "btn-outline"} !py-1`}>{following ? "★ フォロー中" : "☆ この出品者をフォロー"}</button>
            </form>
          </div>
        </div>
      </div>

      {/* スマホ固定入札バー */}
      {canBidHere && <StickyBidBar price={l.current_price} />}
    </div>
  );
}
