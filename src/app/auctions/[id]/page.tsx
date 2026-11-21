import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { bidStatus, extensionSeconds, finalizeEnded, getBids, getListing, isFavorite, isFollowing, minimumBid } from "@/lib/auctions";
import { canBid, getCurrentUser, needsRegistration } from "@/lib/auth";
import { CERTIFICATE_LABELS, siteConfig } from "@/lib/config";
import { formatDateTime, remaining, yen } from "@/lib/format";
import { confirmBidAction, favoriteAction, followAction } from "./actions";
import Countdown from "@/components/Countdown";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; bid?: string; outcome?: string; price?: string; extended?: string }> };

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
        <div className="card overflow-hidden aspect-[4/3] bg-surface-2 flex items-center justify-center">
          {l.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.image_url} alt={l.title} className="h-full w-full object-contain" />
          ) : (
            <span className="text-muted">画像なし</span>
          )}
        </div>
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
            <dt className="text-muted">入札単位</dt><dd>{yen(l.bid_increment)}</dd>
            <dt className="text-muted">開始</dt><dd>{formatDateTime(l.starts_at)}</dd>
            <dt className="text-muted">終了</dt><dd>{formatDateTime(l.ends_at)}{l.extended_count > 0 && <span className="text-muted text-xs ml-1">（{l.extended_count}回延長）</span>}</dd>
          </dl>
          {l.description && <p className="whitespace-pre-wrap pt-2 border-t border-accent/10">{l.description}</p>}
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap gap-1 items-center">
            {l.featured ? <span className="badge badge-star">⭐注目</span> : null}
            {l.hot ? <span className="badge badge-hot">🔥</span> : null}
            {l.status === "scheduled" && <span className="badge">開催前</span>}
            {l.status === "ended" && <span className="badge">終了</span>}
            {l.status === "cancelled" && <span className="badge">取消</span>}
          </div>
          <h1 className="text-xl font-black leading-snug">{l.title}</h1>
          <div>
            <div className="text-sm text-muted">{open ? "現在価格" : l.status === "ended" ? "落札価格" : "価格"}</div>
            <div className="text-3xl font-black text-accent-2">{yen(l.current_price)}</div>
            <div className="text-xs text-muted">入札 {l.bid_count} 件</div>
          </div>
          {open && (
            <div className="text-sm">
              <Countdown endsAt={l.ends_at} fallback={remaining(l.ends_at)} />
              <span className="text-muted ml-2">（終了 {formatDateTime(l.ends_at)}）</span>
            </div>
          )}

          {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}
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
                <button className="btn w-full text-lg">入札内容を確認する</button>
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
                <p className="mt-2 text-ok">
                  おめでとうございます。お支払いは{siteConfig.payment.method}です。<Link href="/mypage" className="underline">マイページ</Link>で発送先をご確認ください。
                </p>
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

        <div className="card p-4">
          <h2 className="font-bold text-accent-2 mb-2">入札履歴</h2>
          {bids.length === 0 ? (
            <p className="text-sm text-muted">まだ入札はありません。</p>
          ) : (
            <ol className="text-sm divide-y divide-accent/10">
              {bids.slice(0, 20).map((b, i) => (
                <li key={b.id} className="py-1.5 flex justify-between">
                  <span>{i === 0 && open ? "🏆 " : ""}{user && b.user_id === user.id ? "あなた" : b.bidder_label}{b.is_auto ? <span className="text-xs text-muted ml-1">(自動)</span> : null}</span>
                  <span className="text-muted">{formatDateTime(b.created_at)}</span>
                  <span className="font-bold">{yen(b.amount)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
