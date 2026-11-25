import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { pendingVarieties, traitsOf } from "@/lib/zukan";
import { varietyStatusAction } from "../actions";

export const metadata: Metadata = { title: "図鑑の確認" };
export const dynamic = "force-dynamic";

export default async function AdminZukanPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/zukan");
  if (user.role !== "admin") redirect("/auctions");
  const items = pendingVarieties();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-accent-2">図鑑：品種登録の確認（{items.length}）</h1>
      <div className="card divide-y divide-accent/10 text-sm">
        {items.map((v) => (
          <div key={v.id} className="p-3 flex flex-wrap justify-between gap-2">
            <div>
              <Link href={`/zukan/${v.id}`} className="font-bold hover:text-accent-2">{v.name}</Link>
              <div className="text-xs text-muted">{v.breeder_name} ・ {v.prefecture} {v.instagram && `・ @${v.instagram}`}</div>
              <div className="flex flex-wrap gap-1 mt-1">{traitsOf(v).map((t) => <span key={t} className="badge">{t}</span>)}</div>
            </div>
            <div className="flex gap-1">
              <form action={varietyStatusAction}><input type="hidden" name="id" value={v.id} /><input type="hidden" name="status" value="approved" /><button className="btn !py-1 text-xs">掲載</button></form>
              <form action={varietyStatusAction}><input type="hidden" name="id" value={v.id} /><input type="hidden" name="status" value="rejected" /><button className="btn btn-outline !py-1 text-xs">却下</button></form>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="p-4 text-muted">確認待ちはありません。</p>}
      </div>
    </div>
  );
}
