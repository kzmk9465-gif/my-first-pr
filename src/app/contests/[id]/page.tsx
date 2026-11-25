import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { entries, getContest, myVote } from "@/lib/contests";
import { canBid, getCurrentUser } from "@/lib/auth";
import { enterContestAction, voteAction } from "../actions";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; entered?: string; voted?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { const c = getContest(Number((await params).id)); return { title: c ? c.title : "品評会" }; }

export default async function ContestPage({ params, searchParams }: Props) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const c = getContest(id);
  if (!c) notFound();
  const user = await getCurrentUser();
  const allowed = !!user && canBid(user);
  const list = entries(id);
  const mine = user ? myVote(id, user.id) : null;
  const total = list.reduce((a, e) => a + e.votes, 0);
  return (
    <div className="space-y-4">
      <nav className="text-xs text-muted"><Link href="/contests" className="hover:text-accent-2">品評会</Link> › {c.title}</nav>
      <div className="card p-4">
        <h1 className="text-2xl font-black text-accent-2">{c.title} <span className={`badge ${c.status === "voting" ? "badge-hot" : c.status === "entry" ? "badge-ok" : ""}`}>{c.status === "entry" ? "エントリー受付中" : c.status === "voting" ? "投票受付中" : "結果発表"}</span></h1>
        {c.description && <p className="text-sm text-muted mt-1 whitespace-pre-wrap">{c.description}</p>}
      </div>
      {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}
      {sp.entered && <p className="text-ok text-sm border border-ok/40 rounded p-2">エントリーしました。</p>}
      {sp.voted && <p className="text-ok text-sm border border-ok/40 rounded p-2">投票しました（投票期間中は変更できます）。</p>}

      {c.status === "entry" && (
        user ? allowed ? (
          <form action={enterContestAction} className="card p-4 space-y-2 text-sm">
            <input type="hidden" name="contest_id" value={id} />
            <h2 className="font-bold text-accent-2">エントリーする（1人3点まで）</h2>
            <input name="title" required className="input" placeholder="個体名・品種（例: 三色ラメ幹之 2歳メス）" />
            <input name="image_url" type="url" className="input" placeholder="画像URL（任意）" />
            <textarea name="description" rows={2} className="input" placeholder="アピールポイント（任意）" />
            <button className="btn">エントリー</button>
          </form>
        ) : <p className="card p-4 text-sm text-muted">承認済み会員になるとエントリーできます。</p> : <Link href={`/login?next=/contests/${id}`} className="btn">ログインしてエントリー</Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((e, i) => (
          <div key={e.id} className={`card overflow-hidden ${c.status === "closed" && i === 0 ? "border-accent" : ""}`}>
            <div className="aspect-[4/3] bg-surface-2 flex items-center justify-center relative">
              {e.image_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={e.image_url} alt={e.title} className="h-full w-full object-cover" /> : <span className="text-muted text-sm">画像なし</span>}
              {c.status === "closed" && i < 3 && <span className="absolute left-2 top-2 badge badge-star bg-background/80">{["🥇 優勝", "🥈 2位", "🥉 3位"][i]}</span>}
            </div>
            <div className="p-3 text-sm space-y-1">
              <div className="font-bold">{e.title}</div>
              <div className="text-xs text-muted">{e.entrant}</div>
              {e.description && <p className="text-xs text-muted">{e.description}</p>}
              {c.status !== "entry" && <div className="text-xs">得票 <b className="text-accent-2">{e.votes}</b>{total > 0 && `（${Math.round((100 * e.votes) / total)}%）`}</div>}
              {c.status === "voting" && user && allowed && e.user_id !== user.id && (
                <form action={voteAction}><input type="hidden" name="contest_id" value={id} /><input type="hidden" name="entry_id" value={e.id} /><button className={`btn w-full !py-1 ${mine === e.id ? "" : "btn-outline"}`}>{mine === e.id ? "✓ 投票済み" : "この個体に投票"}</button></form>
              )}
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="card p-6 text-muted text-sm sm:col-span-3">まだエントリーはありません。</p>}
      </div>
      {c.status === "voting" && !user && <Link href={`/login?next=/contests/${id}`} className="btn">ログインして投票</Link>}
    </div>
  );
}
