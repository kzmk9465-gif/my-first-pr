import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, listMembers } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { setMemberStatusAction } from "../actions";

export const metadata: Metadata = { title: "会員管理" };
export const dynamic = "force-dynamic";

const LABEL = { pending: "承認待ち", approved: "承認済み", blocked: "停止" } as const;

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/members");
  if (user.role !== "admin") redirect("/auctions");
  const sp = await searchParams;
  const filter = (["pending", "approved", "blocked", "all"] as const).find((v) => v === sp.f) ?? "pending";
  const members = listMembers(filter);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-accent-2">会員管理</h1>
      <div className="flex gap-2 text-xs">
        {(["pending", "approved", "blocked", "all"] as const).map((f) => (
          <a key={f} href={`/admin/members?f=${f}`} className={`badge ${filter === f ? "badge-star" : ""}`}>{f === "all" ? "すべて" : LABEL[f]}</a>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted text-xs text-left"><tr><th className="p-2">会員</th><th>屋号 / SNS</th><th>発送先</th><th>状態</th><th>登録</th><th></th></tr></thead>
          <tbody className="divide-y divide-accent/10">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="p-2"><div>{m.name ?? <span className="text-muted">（未登録）</span>}</div><div className="text-xs text-muted">{m.email}</div></td>
                <td className="p-2 text-xs">{m.shop_name && <div>{m.shop_name}</div>}{m.instagram && <a className="text-accent-2 underline" href={`https://www.instagram.com/${m.instagram}/`} target="_blank" rel="noreferrer">@{m.instagram}</a>}</td>
                <td className="p-2 text-xs text-muted">{m.shipping_address ? `〒${m.shipping_postal} ${m.shipping_address} ${m.shipping_phone}` : "未登録"}</td>
                <td className="p-2"><span className={`badge ${m.status === "approved" ? "badge-ok" : m.status === "blocked" ? "" : "badge-hot"}`}>{LABEL[m.status]}</span>{m.role === "admin" && <span className="badge badge-star ml-1">管理者</span>}</td>
                <td className="p-2 text-xs text-muted whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                <td className="p-2 whitespace-nowrap">
                  <div className="flex gap-1">
                    {m.status !== "approved" && <StatusButton id={m.id} f={filter} status="approved" label="承認" primary />}
                    {m.status !== "blocked" && m.role !== "admin" && <StatusButton id={m.id} f={filter} status="blocked" label="停止" />}
                    {m.status === "blocked" && <StatusButton id={m.id} f={filter} status="pending" label="承認待ちに戻す" />}
                  </div>
                </td>
              </tr>
            ))}
            {members.length === 0 && <tr><td className="p-4 text-muted" colSpan={6}>該当する会員はいません。</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusButton({ id, f, status, label, primary }: { id: number; f: string; status: string; label: string; primary?: boolean }) {
  return (
    <form action={setMemberStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="f" value={f} />
      <input type="hidden" name="status" value={status} />
      <button className={`btn ${primary ? "" : "btn-outline"} !py-0.5 !px-2 text-xs`}>{label}</button>
    </form>
  );
}
