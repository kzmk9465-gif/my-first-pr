import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSellers } from "@/lib/auctions";
import { createSellerAction, sellerAccountAction } from "../actions";
import { getSellerById } from "@/lib/sellers";
import { getUserById } from "@/lib/auctions";
import { FEE_PLAN_LABELS, siteConfig } from "@/lib/config";

export const metadata: Metadata = { title: "出品者管理" };
export const dynamic = "force-dynamic";

export default async function SellersAdminPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; pin?: string; seller?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/sellers");
  if (user.role !== "admin") redirect("/auctions");
  const sp = await searchParams;
  const sellers = getSellers();
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-black text-accent-2">出品者管理</h1>
      {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}
      {sp.saved && <p className="text-ok text-sm border border-ok/40 rounded p-2">保存しました。</p>}
      {sp.pin && (
        <p className="text-sm border border-accent rounded p-3">
          出品者 ID:{sp.seller} の新しいPINコードは <b className="text-xl tracking-widest text-accent-2">{sp.pin}</b> です。
          この画面を閉じると再表示できません。出品者にLINEなどで直接伝えてください。
        </p>
      )}
      <form action={createSellerAction} className="card p-5 space-y-3 text-sm">
        <h2 className="font-bold">出品者を追加（自社・委託元）</h2>
        <label className="block">表示名 *<input name="name" required className="input mt-1" placeholder="例: 播州めだか" /></label>
        <label className="block">スラッグ（URL用、英数字） *<input name="slug" required className="input mt-1" placeholder="例: banshu-medaka" pattern="[a-zA-Z0-9-]+" /></label>
        <label className="block">紹介文<input name="description" className="input mt-1" /></label>
        <button className="btn w-full">追加</button>
      </form>
      <div className="space-y-3">
        {sellers.map((s) => {
          const acc = getSellerById(s.id)!;
          const owner = acc.user_id ? getUserById(acc.user_id) : undefined;
          const planKey = siteConfig.feePlans.find((p) => p.rate === acc.fee_rate)?.key ?? "custom";
          return (
            <details key={s.id} className="card p-3 text-sm" open={sp.seller === String(s.id)}>
              <summary className="flex flex-wrap justify-between gap-2 cursor-pointer">
                <span className="font-bold">{s.name} <span className="text-xs text-muted font-normal">/sellers/{s.slug}</span></span>
                <span className="text-xs text-muted">{owner ? `${owner.email} に紐づけ` : "会員未紐づけ（管理者のみ出品）"} ・ 手数料 {acc.fee_rate}% ・ PIN {acc.pin_hash ? "設定済み" : "未発行"}</span>
              </summary>
              <form action={sellerAccountAction} className="mt-3 grid gap-2 md:grid-cols-2 text-xs">
                <input type="hidden" name="seller_id" value={s.id} />
                <label className="block">出品できる会員のメールアドレス<input name="user_email" className="input mt-1" defaultValue={owner?.email ?? ""} placeholder="空欄で紐づけ解除" /></label>
                <label className="block">手数料プラン
                  <select name="fee_plan" className="input mt-1" defaultValue={planKey}>
                    {siteConfig.feePlans.map((p) => <option key={p.key} value={p.key}>{FEE_PLAN_LABELS[p.key] ?? p.key}：{p.rate}%</option>)}
                    <option value="custom">個別に指定</option>
                  </select>
                </label>
                <label className="block">個別指定の手数料（%）<input name="fee_rate" type="number" min={0} max={100} defaultValue={acc.fee_rate} className="input mt-1" /></label>
                <label className="flex items-center gap-2"><input type="checkbox" name="accepts_online" defaultChecked={!!acc.accepts_online} /> オンライン決済（カード・PayPay）を受け付ける</label>
                <label className="flex items-center gap-2 mt-4"><input type="checkbox" name="issue_pin" /> PINコードを{acc.pin_hash ? "再" : ""}発行する（保存後に1回だけ表示）</label>
                <button className="btn md:col-span-2">保存</button>
              </form>
            </details>
          );
        })}
        {sellers.length === 0 && <p className="card p-3 text-muted text-sm">まだ出品者がいません。</p>}
      </div>
    </div>
  );
}
