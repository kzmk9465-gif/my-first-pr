import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { pendingSecondaryCertificates } from "@/lib/certificates";
import { formatDateTime } from "@/lib/format";
import { reviewCertificateAction } from "../actions";

export const metadata: Metadata = { title: "証明書の確認" };
export const dynamic = "force-dynamic";

export default async function AdminCertificatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/certificates");
  if (user.role !== "admin") redirect("/auctions");
  const pending = pendingSecondaryCertificates();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-accent-2">二次販売証明の申請（{pending.length}）</h1>
      <p className="text-xs text-muted">落札個体から殖やした子の販売証明です。親証明の所有者からの申請か、内容が妥当かを確認して発行してください。</p>
      <div className="card divide-y divide-accent/10 text-sm">
        {pending.map((c) => (
          <div key={c.id} className="p-3 flex flex-wrap justify-between gap-2">
            <div>
              <div className="font-bold">{c.title} <span className="font-mono text-xs text-muted">{c.code}</span></div>
              <div className="text-xs text-muted">申請者 {c.holder_name} &lt;{c.email}&gt; ・ 親証明 <Link href={`/certificates/${c.parent_code}`} className="underline font-mono">{c.parent_code}</Link> ・ {formatDateTime(c.created_at)}</div>
              {c.note && <div className="text-xs mt-1 whitespace-pre-wrap">{c.note}</div>}
            </div>
            <div className="flex gap-1">
              <form action={reviewCertificateAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="decision" value="approve" /><button className="btn !py-1 text-xs">発行</button></form>
              <form action={reviewCertificateAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="decision" value="reject" /><button className="btn btn-outline !py-1 text-xs">却下</button></form>
            </div>
          </div>
        ))}
        {pending.length === 0 && <p className="p-4 text-muted">申請はありません。</p>}
      </div>
    </div>
  );
}
