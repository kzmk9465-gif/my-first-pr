import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { bidStatus, canRevealMystery, extensionSeconds, finalizeEnded, getBids, getListing, isFavorite, isFollowing, isUnlocked, listingImages, minimumBid } from "@/lib/auctions";
import { getSellerForUser } from "@/lib/sellers";
import Gallery from "@/components/Gallery";
import LiveBoard from "@/components/LiveBoard";
import Danmaku from "@/components/Danmaku";
import { liveState } from "@/lib/auctions";
import { canBid, getCurrentUser, needsRegistration } from "@/lib/auth";
import { CERTIFICATE_LABELS, siteConfig } from "@/lib/config";
import { formatDateTime, yen } from "@/lib/format";
import { confirmBidAction, favoriteAction, followAction, issueCertificateAction, reportAction, unlockAction } from "./actions";
import { userRank, rankByLevel } from "@/lib/ranks";
import { certificateForListing } from "@/lib/certificates";
import { getOrder } from "@/lib/sellers";

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
    // 確認待ちは管理者と出品者本人だけ閲覧できる
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
  const ytId = l.video_url?.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{6,})/)?.[1];
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

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        <nav className="text-xs text-muted"><Link href="/auctions" className="hover:text-accent-2">オークション一覧</Link> › ID:{l.id}</nav>
        <Gallery images={images} title={l.title} silhouette={!reveal} />
        {l.mystery && !reveal ? <p className="text-xs text-muted text-center">📦 千両箱：中身は落札してからのお楽しみ。画像はシルエットで表示しています。</p> : null}
        {l.status !== "review" && <Danmaku listingId={l.id} canPost={!!user && allowed} enabled={!!l.comments_enabled} />}
        {ytId && (
          <div className="card overflow-hidden aspect-video">
            <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${ytId}?rel=0&playsinline=1&modestbranding=1&autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=1`} title="出品動画" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
          </div>
        )}
        <div className="card p-4 space-y-2 text-sm">
          <h2 className="font-bold text-accent-2">出品情報</h2>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-1">
            <dt className="text-muted">出品者</dt>
            <dd><Link href={`/sellers/${l.seller_slug}`} className="text-accent-2 hover:underline">{l.seller_name}</Link></dd>
            {l.breeder && (<><dt className="text-muted">作出</dt><dd>{l.breeder}</dd></>)}
            {l.variety && (<><dt className="text-muted">品種</dt><dd>{l.variety}</dd></>)}
            {l.quantity && (<><dt className="text-muted">数量</dt><dd>{l.quantity}</dd></>)}
            {l.certificate && (<><dt className="text-muted">証明</dt><dd><span className="badge badge-ok">{CERTIFICATE_LABELS[l.certificate]} ✓</span></dd></>)}
            <dt className="text-muted">開始価格</dt><dd>{yen(l.start_price)}</dd>
            {l.buyout_price && (<><dt className="text-muted">即決価格</dt><dd>{yen(l.buyout_price)}</dd></>)}
            <dt className="text-muted">送料</dt><dd>{yen(l.shipping_fee)}（{l.shipping_method === "cool" ? "クール便" : "常温便"}・落札者負担）</dd>
            <dt className="text-muted">入札単位</dt><dd>{yen(l.bid_increment)}</dd>
            <dt className="text-muted">開始</dt><dd>{formatDateTime(l.starts_at)}</dd>
            <dt className="text-muted">終了</dt><dd>{formatDateTime(l.ends_at)}{l.extended_count > 0 && <span className="text-muted text-xs ml-1">（{l.extended_count}回延長）</span>}</dd>
          </dl>
          {l.description && <p className="whitespace-pre-wrap pt-2 border-t border-accent/10">{l.description}</p>}
        </div>
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

      <div className="space-y-4">
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap gap-1 items-center">
            {l.featured ? <span className="badge badge-star">⭐注目</span> : null}
            {l.hot ? <span className="badge badge-hot">🔥</span> : null}
            {l.status === "review" && <span className="badge badge-hot">確認待ち（非公開）</span>}
            {l.min_rank > 0 && <span className="badge badge-hot">🌑 闇市：{rankByLevel(l.min_rank).name}以上</span>}
            {l.passphrase_hash && <span className="badge badge-star">🔒 限定（合言葉）</span>}
            {l.mystery ? <span className="badge badge-star">📦 千両箱</span> : null}
            {l.status === "scheduled" && <span className="badge">開催前</span>}
            {l.status === "ended" && <span className="badge">終了</span>}
            {l.status === "cancelled" && <span className="badge">取消</span>}
          </div>
          <h1 className="text-xl font-black leading-snug">{l.title}</h1>
          {l.subtitle && <p className="text-sm text-muted -mt-2">{l.subtitle}</p>}
          <LiveBoard listingId={l.id} initial={liveInit} open={open} myUserId={user?.id ?? null} />

          {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}
          {sp.unlocked && <p className="text-ok text-sm border border-ok/40 rounded p-2">🔓 合言葉を確認しました。入札できます。</p>}
          {sp.bought && <p className="text-ok text-sm border border-ok/40 rounded p-2">🏆 即決価格 {yen(Number(sp.bought))} で落札しました。<Link href="/mypage#orders" className="underline">マイページの「取引のいま」</Link>からお支払い手続きへお進みください。</p>}
          {sp.bid && sp.outcome === "lost" && (
            <p className="text-danger text-sm border border-danger/40 rounded p-2">
              上限 {yen(Number(sp.bid))} では他の方の上限に届きませんでした。価格は {yen(Number(sp.price))} になりました。もう一度、より高い上限で挑戦できます。
            </p>
          )}
          {sp.bid && sp.outcome === "raised" && (
            <p className="text-ok text-sm border border-ok/40 rounded p-2">上限額を {yen(Number(sp.bid))} に引き上げました。あなたが引き続き最高入札者です。</p>
          )}
          {sp.bid && sp.outcome === "leading" && (
            <p className="text-ok text-sm border border-ok/40 rounded p-2">
              🏆 上限 {yen(Number(sp.bid))} で入札し、現在 {yen(Number(sp.price))} であなたが最高入札者です。{sp.extended && "終了間際のため終了時刻が延長されました。"}
            </p>
          )}

          {open ? (
            user ? needReg ? (
              <Link href={`/register?next=${encodeURIComponent(back)}`} className="btn w-full">会員登録して入札</Link>
            ) : !allowed ? (
              <p className="text-sm text-muted border border-accent/20 rounded p-2">
                {user.status === "blocked" ? "このアカウントは入札できません。" : "会員登録の承認待ちです。承認されると入札できます。"}
              </p>
            ) : !rankOk ? (
              <p className="text-sm text-muted border border-accent/20 rounded p-2">
                🌑 この出品は闇市です。会員ランク「{rankByLevel(l.min_rank).name}」以上の方のみ入札できます（あなたは「{myRank?.rank.name}」、累計 {yen(myRank?.total ?? 0)}）。
              </p>
            ) : !unlocked ? (
              <form action={unlockAction} className="space-y-2 border border-accent/30 rounded p-3">
                <input type="hidden" name="listing_id" value={l.id} />
                <p className="text-sm">🔒 限定オークションです。合言葉を入力してください。</p>
                <input name="passphrase" required className="input" placeholder="合言葉" autoComplete="off" />
                <button className="btn w-full">合言葉を送る</button>
              </form>
            ) : (
              <form action={confirmBidAction} className="space-y-2">
                <input type="hidden" name="listing_id" value={l.id} />
                <label className="block text-sm text-muted">
                  上限額（{iAmTop ? `現在の上限 ${yen(st.my_max ?? 0)} より上` : `${yen(min)} 以上`}）
                  <input name="amount" type="number" inputMode="numeric" min={iAmTop ? (st.my_max ?? 0) + 1 : min} step={1} defaultValue={iAmTop ? (st.my_max ?? 0) + l.bid_increment : min} required className="input mt-1 text-lg" />
                </label>
                {iAmTop ? (
                  <p className="text-xs text-ok">🏆 あなたが現在の最高入札者です（上限 {yen(st.my_max ?? 0)}）。上限を引き上げられます。</p>
                ) : (
                  <p className="text-xs text-muted">「ここまでなら出せる」上限を入れると、他の方の入札に応じて自動で競り上がります（上限を超えることはありません）。</p>
                )}
                <p className="text-xs text-muted">終了{Math.round(siteConfig.autoExtendWindowSeconds / 60)}分以内の入札で{extMin}分延長{l.sudden_death ? "（サドンデス：回数ごとに短縮）" : ""}。</p>
                {myRank && <p className="text-xs text-muted">あなたのランク：<b className="text-accent-2">{myRank.rank.name}</b>（累計 {yen(myRank.total)}）</p>}
                <button className="btn w-full text-lg">入札内容を確認する</button>
                {canBuyout && (
                  <Link href={`/auctions/${l.id}/buyout`} className="btn btn-outline w-full">即決 {yen(l.buyout_price!)} で落札する</Link>
                )}
              </form>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(back)}`} className="btn w-full">ログインして入札</Link>
            )
          ) : l.status === "ended" ? (
            <div className="text-sm">
              {top ? (
                <p>落札者：<b>{iWon ? "あなた" : top.bidder_label}</b></p>
              ) : (
                <p className="text-muted">入札はありませんでした。</p>
              )}
              {iWon && (
                <div className="mt-2 space-y-2">
                  <p className="text-ok">おめでとうございます。<Link href="/mypage?received=#orders" className="underline">マイページの「取引のいま」</Link>からお支払い手続きへお進みください。</p>
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

        <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
          <form action={favoriteAction}>
            <input type="hidden" name="listing_id" value={l.id} />
            <input type="hidden" name="back" value={back} />
            <button className={`btn btn-outline !py-1 ${fav ? "!text-danger !border-danger" : ""}`}>{fav ? "♥ お気に入り済み" : "♡ お気に入り"}</button>
          </form>
          <div className="text-sm text-right">
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
  );
}
