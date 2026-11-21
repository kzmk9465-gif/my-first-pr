import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSellers } from "@/lib/auctions";
import { createSellerAction } from "../actions";

export const metadata: Metadata = { title: "出品者管理" };
export const dynamic = "force-dynamic";

export default async function SellersAdminPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/sellers");
  if (user.role !== "admin") redirect("/auctions");
  const sp = await searchParams;
  const sellers = getSellers();
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-black text-accent-2">出品者管理</h1>
      {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}
      {sp.saved && <p className="text-ok text-sm border border-ok/40 rounded p-2">登録しました。</p>}
      <form action={createSellerAction} className="card p-5 space-y-3 text-sm">
        <h2 className="font-bold">出品者を追加（自社・委託元）</h2>
        <label className="block">表示名 *<input name="name" required className="input mt-1" placeholder="例: 播州めだか" /></label>
        <label className="block">スラッグ（URL用、英数字） *<input name="slug" required className="input mt-1" placeholder="例: banshu-medaka" pattern="[a-zA-Z0-9-]+" /></label>
        <label className="block">紹介文<input name="description" className="input mt-1" /></label>
        <button className="btn w-full">追加</button>
      </form>
      <ul className="card divide-y divide-accent/10 text-sm">
        {sellers.map((s) => (
          <li key={s.id} className="p-3 flex justify-between"><span>{s.name}</span><Link href={`/sellers/${s.slug}`} className="text-muted hover:text-accent-2">/sellers/{s.slug}</Link></li>
        ))}
        {sellers.length === 0 && <li className="p-3 text-muted">まだ出品者がいません。</li>}
      </ul>
    </div>
  );
}
