import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { openReports } from "@/lib/reports";
import { formatDateTime } from "@/lib/format";
import { handleReportAction } from "../actions";

export const metadata: Metadata = { title: "奉行所（通報）" };
export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/reports");
  if (user.role !== "admin") redirect("/auctions");
  const items = openReports();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-accent-2">奉行所：通報（{items.length}）</h1>
      <div className="card divide-y divide-accent/10 text-sm">
        {items.map((r) => (
          <div key={r.id} className="p-3 flex flex-wrap justify-between gap-2">
            <div>
              <Link href={`/auctions/${r.listing_id}`} className="font-bold hover:text-accent-2">{r.title}</Link>
              <div className="text-xs text-muted">通報者 {r.email} ・ {formatDateTime(r.created_at)}</div>
              <p className="text-xs mt-1 whitespace-pre-wrap">{r.reason}</p>
            </div>
            <div className="flex gap-1">
              <form action={handleReportAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="listing_id" value={r.listing_id} /><button className="btn btn-outline !py-1 text-xs">問題なし（対応済み）</button></form>
              <form action={handleReportAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="listing_id" value={r.listing_id} /><input type="hidden" name="cancel" value="1" /><button className="btn !py-1 text-xs">出品を取消して対応済み</button></form>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="p-4 text-muted">未対応の通報はありません。</p>}
      </div>
    </div>
  );
}
