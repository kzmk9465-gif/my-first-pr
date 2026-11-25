import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSellers } from "@/lib/auctions";
import { siteConfig } from "@/lib/config";
import { toLocalInputValue } from "@/lib/format";
import { createListingAction } from "../../actions";

export const metadata: Metadata = { title: "新規出品" };
export const dynamic = "force-dynamic";

export default async function NewListingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/listings/new");
  if (user.role !== "admin") redirect("/auctions");
  const sp = await searchParams;
  const sellers = getSellers();
  const defaultEnd = toLocalInputValue(new Date(Date.now() + 3 * 86_400_000).toISOString()).slice(0, 11) + "21:30";

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-black text-accent-2">新規出品</h1>
      {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}
      {sellers.length === 0 && <p className="text-sm text-danger">先に<Link href="/admin/sellers" className="underline">出品者</Link>を登録してください。</p>}
      <form action={createListingAction} className="card p-5 space-y-3 text-sm">
        <label className="block">出品者 *
          <select name="seller_id" required className="input mt-1">
            {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="block">タイトル *<input name="title" required className="input mt-1" placeholder="例: 播州めだか) 三色ラメ 1ペア 11/25 21:30終了" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">品種<input name="variety" className="input mt-1" placeholder="例: 三色ラメ幹之" /></label>
          <label className="block">作出者<input name="breeder" className="input mt-1" placeholder="例: 播州めだか" /></label>
          <label className="block">数量<input name="quantity" className="input mt-1" placeholder="例: 1ペア / オス1メス2" /></label>
          <label className="block">証明
            <select name="certificate" className="input mt-1">
              <option value="">なし</option>
              <option value="original">原作出証明</option>
              <option value="sales">販売証明</option>
              <option value="bloodline">繁殖血統</option>
            </select>
          </label>
          <label className="block">開始価格（円） *<input name="start_price" type="number" min={1} required defaultValue={1000} className="input mt-1" /></label>
          <label className="block">即決価格（円・任意）<input name="buyout_price" type="number" min={1} className="input mt-1" placeholder="空欄で即決なし" /></label>
          <label className="block">入札単位（円）<input name="bid_increment" type="number" min={1} defaultValue={siteConfig.defaultBidIncrement} className="input mt-1" /></label>
          <label className="block">サブタイトル<input name="subtitle" className="input mt-1" placeholder="補足説明（任意）" /></label>
          <label className="block">YouTube動画URL<input name="video_url" type="url" className="input mt-1" placeholder="https://youtu.be/..." /></label>
          <label className="block">開始日時（空欄で即時）<input name="starts_at" type="datetime-local" className="input mt-1" /></label>
          <label className="block">終了日時 *<input name="ends_at" type="datetime-local" required defaultValue={defaultEnd} className="input mt-1" /></label>
        </div>
        <label className="block">画像URL<input name="image_url" type="url" className="input mt-1" placeholder="https://..." /></label>
        <label className="block">説明<textarea name="description" rows={6} className="input mt-1" placeholder="サイズ、特徴、発送方法、死着保証の有無など" /></label>
        <fieldset className="border border-accent/20 rounded p-3 space-y-2">
          <legend className="px-1 text-xs text-muted">特殊オークション（任意）</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">🌑 闇市（入札できる最低ランク）
              <select name="min_rank" className="input mt-1" defaultValue={0}>
                {siteConfig.ranks.map((r) => <option key={r.level} value={r.level}>{r.level === 0 ? "制限なし" : `${r.name}以上（累計 ${r.min.toLocaleString()}円〜）`}</option>)}
              </select>
            </label>
            <label className="block">🔒 限定（合言葉）<input name="passphrase" className="input mt-1" placeholder="空欄で制限なし" autoComplete="off" /></label>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" name="mystery" /> 📦 千両箱（画像をシルエット表示。中身は落札者だけが見られます）</label>
        </fieldset>
        <div className="flex gap-6">
          <label className="flex items-center gap-2"><input type="checkbox" name="featured" /> ⭐注目として先頭に表示</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="hot" /> 🔥マークを付ける</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="sudden_death" defaultChecked={siteConfig.suddenDeathDefault} /> サドンデス（延長が回数ごとに短くなる）</label>
        </div>
        <button className="btn w-full" disabled={sellers.length === 0}>出品する</button>
      </form>
    </div>
  );
}
