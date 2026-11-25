import type { Metadata } from "next";
import Link from "next/link";
import { listContests } from "@/lib/contests";

export const metadata: Metadata = { title: "品評会" };
export const dynamic = "force-dynamic";
const LABEL = { entry: "エントリー受付中", voting: "投票受付中", closed: "終了（結果発表）" } as const;

export default function ContestsPage() {
  const items = listContests();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-accent-2">品評会（メダカフェア）</h1>
      <p className="text-xs text-muted">会員が自慢の個体をエントリーし、会員の投票で順位を決めます。エントリー・投票には会員登録とログインが必要です。</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((c) => (
          <Link key={c.id} href={`/contests/${c.id}`} className="card p-4 hover:border-accent/50">
            <div className="flex justify-between gap-2"><span className="font-bold">{c.title}</span><span className={`badge ${c.status === "voting" ? "badge-hot" : c.status === "entry" ? "badge-ok" : ""}`}>{LABEL[c.status]}</span></div>
            {c.description && <p className="text-xs text-muted mt-1 line-clamp-2">{c.description}</p>}
          </Link>
        ))}
        {items.length === 0 && <p className="card p-6 text-muted text-sm">開催中の品評会はありません。</p>}
      </div>
    </div>
  );
}
