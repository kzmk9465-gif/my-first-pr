import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { allNews } from "@/lib/news";
import { formatDateTime } from "@/lib/format";
import { createNewsAction, toggleNewsAction } from "../actions";

export const metadata: Metadata = { title: "お知らせ・告知" };
export const dynamic = "force-dynamic";

const KIND = { news: "播州新聞（お知らせ）", alert: "緊急告知バー", broadcast: "でか文字放送" } as const;

export default async function AdminNewsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/news");
  if (user.role !== "admin") redirect("/auctions");
  const sp = await searchParams;
  const items = allNews();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-accent-2">お知らせ・告知</h1>
      {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}
      {sp.saved && <p className="text-ok text-sm border border-ok/40 rounded p-2">掲載しました。</p>}
      <form action={createNewsAction} className="card p-4 grid gap-2 md:grid-cols-2 text-sm">
        <label className="block">種類
          <select name="kind" className="input mt-1">
            <option value="news">播州新聞（お知らせ・右下の「新」ボタンから読める）</option>
            <option value="alert">緊急告知バー（サイト上部に表示）</option>
            <option value="broadcast">でか文字放送（画面中央に大きく。1回閉じると再表示しない）</option>
          </select>
        </label>
        <label className="block">自動で消えるまで（分・空欄で無期限）<input name="expires" type="number" min={1} className="input mt-1" placeholder="例: 60" /></label>
        <label className="block md:col-span-2">見出し *<input name="title" required className="input mt-1" placeholder="例: 本日21時より限定オークション開催" /></label>
        <label className="block md:col-span-2">本文（播州新聞・告知バーで表示）<textarea name="body" rows={3} className="input mt-1" /></label>
        <label className="block md:col-span-2">画像URL（任意）<input name="image_url" type="url" className="input mt-1" /></label>
        <button className="btn md:col-span-2">掲載する</button>
      </form>
      <div className="card divide-y divide-accent/10 text-sm">
        {items.map((n) => (
          <div key={n.id} className="p-3 flex flex-wrap justify-between gap-2">
            <div>
              <span className="badge mr-2">{KIND[n.kind]}</span><b>{n.title}</b>
              <div className="text-xs text-muted">{formatDateTime(n.created_at)}{n.expires_at && ` ・ ${formatDateTime(n.expires_at)} まで`}{!n.active && " ・ 非表示"}</div>
            </div>
            <form action={toggleNewsAction}><input type="hidden" name="id" value={n.id} /><input type="hidden" name="active" value={n.active ? "0" : "1"} /><button className="btn btn-outline !py-1 text-xs">{n.active ? "非表示にする" : "再表示"}</button></form>
          </div>
        ))}
        {items.length === 0 && <p className="p-4 text-muted">まだ掲載はありません。</p>}
      </div>
    </div>
  );
}
