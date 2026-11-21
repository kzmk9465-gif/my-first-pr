import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { TRAIT_GROUPS, varietiesByUser } from "@/lib/zukan";
import { registerVarietyAction } from "../actions";

export const metadata: Metadata = { title: "品種を登録" };
export const dynamic = "force-dynamic";

export default async function NewVarietyPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/zukan/new");
  const mine = varietiesByUser(user.id);
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <nav className="text-xs text-muted"><Link href="/zukan" className="hover:text-accent-2">← メダカ図鑑</Link></nav>
      <h1 className="text-2xl font-black text-accent-2">品種を登録</h1>
      <p className="text-xs text-muted">ご自身が作出した品種を登録できます。お店の確認後に図鑑に掲載され、ブリーダー情報（屋号・都道府県・Instagram）と紐づきます。</p>
      {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}
      {sp.saved && <p className="text-ok text-sm border border-ok/40 rounded p-2">登録を受け付けました。{user.role === "admin" ? "掲載しました。" : "お店の確認後に掲載されます。"}</p>}
      <form action={registerVarietyAction} className="card p-5 space-y-3 text-sm">
        <label className="block">品種名 *<input name="name" required className="input mt-1" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">作出者（屋号）<input name="breeder_name" className="input mt-1" defaultValue={user.shop_name ?? user.name ?? ""} /></label>
          <label className="block">都道府県<input name="prefecture" className="input mt-1" defaultValue={user.prefecture ?? "兵庫県"} /></label>
          <label className="block">Instagram<input name="instagram" className="input mt-1" defaultValue={user.instagram ?? ""} placeholder="@account" /></label>
          <label className="block">画像URL<input name="image_url" type="url" className="input mt-1" /></label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {TRAIT_GROUPS.map((g) => (
            <fieldset key={g.key} className="border border-accent/10 rounded p-2">
              <legend className="text-xs text-muted px-1">{g.label}</legend>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">{g.items.map((t) => <label key={t} className="flex items-center gap-1"><input type="checkbox" name="traits" value={t} />{t}</label>)}</div>
            </fieldset>
          ))}
        </div>
        <label className="block">特徴・説明<textarea name="description" rows={5} className="input mt-1" placeholder="体色、体型、ラメ、ヒレの形状、固定率、作出の経緯など" /></label>
        <button className="btn w-full">登録する</button>
      </form>
      {mine.length > 0 && (
        <div className="card p-4 text-sm">
          <h2 className="font-bold text-accent-2 mb-2">あなたの登録品種</h2>
          <ul className="divide-y divide-accent/10">{mine.map((v) => <li key={v.id} className="py-1 flex justify-between"><Link href={`/zukan/${v.id}`} className="hover:text-accent-2">{v.name}</Link><span className={`badge ${v.status === "approved" ? "badge-ok" : v.status === "pending" ? "badge-hot" : ""}`}>{v.status === "approved" ? "掲載中" : v.status === "pending" ? "確認待ち" : "却下"}</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}
