import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listContests } from "@/lib/contests";
import { contestStatusAction, createContestAction } from "../actions";

export const metadata: Metadata = { title: "品評会の管理" };
export const dynamic = "force-dynamic";

export default async function AdminContestsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/contests");
  if (user.role !== "admin") redirect("/auctions");
  const sp = await searchParams;
  const items = listContests();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-accent-2">品評会の管理</h1>
      {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}
      {sp.saved && <p className="text-ok text-sm border border-ok/40 rounded p-2">作成しました。エントリー受付中です。</p>}
      <form action={createContestAction} className="card p-4 space-y-2 text-sm">
        <input name="title" required className="input" placeholder="例: 第1回 播州めだか品評会（ラメ部門）" />
        <textarea name="description" rows={2} className="input" placeholder="趣旨・賞品・期間など" />
        <button className="btn">品評会を作成</button>
      </form>
      <div className="card divide-y divide-accent/10 text-sm">
        {items.map((c) => (
          <div key={c.id} className="p-3 flex flex-wrap justify-between gap-2">
            <div><Link href={`/contests/${c.id}`} className="font-bold hover:text-accent-2">{c.title}</Link> <span className="badge">{c.status === "entry" ? "エントリー受付中" : c.status === "voting" ? "投票受付中" : "終了"}</span></div>
            <div className="flex gap-1">
              {c.status !== "entry" && <StatusBtn id={c.id} status="entry" label="エントリー受付" />}
              {c.status !== "voting" && <StatusBtn id={c.id} status="voting" label="投票開始" />}
              {c.status !== "closed" && <StatusBtn id={c.id} status="closed" label="締め切り・結果発表" />}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="p-4 text-muted">品評会はまだありません。</p>}
      </div>
    </div>
  );
}

function StatusBtn({ id, status, label }: { id: number; status: string; label: string }) {
  return (
    <form action={contestStatusAction}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} />
      <button className="btn btn-outline !py-1 text-xs">{label}</button>
    </form>
  );
}
