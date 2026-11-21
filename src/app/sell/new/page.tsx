import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sellerContext } from "@/lib/seller-gate";
import { listTemplates, shippingOptions } from "@/lib/sellers";
import { siteConfig } from "@/lib/config";
import { toLocalInputValue } from "@/lib/format";
import { deleteTemplateAction, sellerCreateListingAction } from "../actions";
import TemplatePicker from "@/components/TemplatePicker";

export const metadata: Metadata = { title: "出品する" };
export const dynamic = "force-dynamic";

export default async function SellerNewListingPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const sp = await searchParams;
  const { user, seller, pinOk } = await sellerContext();
  if (!user) redirect("/login?next=/sell/new");
  if (!seller) redirect("/sell");
  if (!pinOk) redirect("/sell/pin?next=/sell/new");
  // node:sqlite の行は null プロトタイプなので、クライアントに渡す前に素のオブジェクトへ
  const templates = listTemplates(seller.id).map((t) => ({ id: t.id, name: t.name, body: t.body }));
  const defaultEnd = toLocalInputValue(new Date(Date.now() + 3 * 86_400_000).toISOString()).slice(0, 11) + "21:30";
  const review = user.role !== "admin";

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <nav className="text-xs text-muted"><Link href="/sell/dashboard" className="hover:text-accent-2">← 出品者ダッシュボード</Link></nav>
      <h1 className="text-2xl font-black text-accent-2">出品する <span className="text-sm text-muted font-normal">（{seller.name} ・ 手数料 {seller.fee_rate}%）</span></h1>
      {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}
      {sp.saved && <p className="text-ok text-sm border border-ok/40 rounded p-2">出品 ID:{sp.saved} を受け付けました。{review ? "お店の確認後に公開されます。" : "公開しました。"}続けて出品できます。</p>}
      <form action={sellerCreateListingAction} className="card p-5 space-y-3 text-sm" encType="multipart/form-data">
        <label className="block">タイトル *<input name="title" required className="input mt-1" placeholder={`例: ${seller.name}) 三色ラメ 1ペア 11/25 21:30終了`} /></label>
        <label className="block">サブタイトル（補足説明）<input name="subtitle" className="input mt-1" placeholder="例: 発送は火・金。死着保証あり" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">品種<input name="variety" className="input mt-1" /></label>
          <label className="block">作出者<input name="breeder" className="input mt-1" defaultValue={seller.name} /></label>
          <label className="block">数量<input name="quantity" className="input mt-1" placeholder="1ペア / オス1メス2" /></label>
          <label className="block">証明
            <select name="certificate" className="input mt-1">
              <option value="">なし</option>
              <option value="original">原作出証明（自分が作出）</option>
              <option value="sales">販売証明（作出者から購入）</option>
              <option value="bloodline">繁殖血統（作出者の血統を繁殖）</option>
            </select>
          </label>
          <label className="block">開始価格（円） *<input name="start_price" type="number" min={1} required defaultValue={1000} className="input mt-1" /></label>
          <label className="block">即決価格（円・任意）<input name="buyout_price" type="number" min={1} className="input mt-1" placeholder="空欄で即決なし" /></label>
          <label className="block">入札単位（円）<input name="bid_increment" type="number" min={1} defaultValue={siteConfig.defaultBidIncrement} className="input mt-1" /></label>
          <label className="block">配送方法
            <select name="shipping_method" className="input mt-1">
              {shippingOptions(seller).map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">開始日時（空欄で即時）<input name="starts_at" type="datetime-local" className="input mt-1" /></label>
          <label className="block">終了日時 *<input name="ends_at" type="datetime-local" required defaultValue={defaultEnd} className="input mt-1" /></label>
        </div>
        <label className="block">画像（最大6枚、1枚8MBまで）<input name="images" type="file" accept="image/*" multiple className="input mt-1" /></label>
        <label className="block">画像URL（任意・外部にある画像を使う場合）<input name="image_url" type="url" className="input mt-1" placeholder="https://..." /></label>
        <label className="block">YouTube動画URL（任意）<input name="video_url" type="url" className="input mt-1" placeholder="https://youtu.be/..." /></label>

        <TemplatePicker templates={templates} />
        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2"><input type="checkbox" name="save_template" /> この説明文をテンプレートとして保存</label>
          <input name="template_name" className="input !w-48 !py-1" placeholder="テンプレート名" />
        </div>
        {templates.length > 0 && (
          <details className="text-xs text-muted">
            <summary>保存済みテンプレート（{templates.length}/10）を管理</summary>
            <ul className="mt-1 space-y-1">
              {templates.map((t) => (
                <li key={t.id} className="flex justify-between gap-2">
                  <span>{t.name}</span>
                  <button formAction={deleteTemplateAction} name="id" value={t.id} className="underline text-danger">削除</button>
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2"><input type="checkbox" name="sudden_death" defaultChecked={siteConfig.suddenDeathDefault} /> サドンデス延長</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="continue" /> 連続出品（保存後もこの画面に戻る）</label>
        </div>
        <p className="text-xs text-muted">{review ? "出品はお店の確認後に公開されます。" : "管理者のため即時公開されます。"}落札価格の {seller.fee_rate}% が手数料、{100 - seller.fee_rate}% がお戻しです。送料は落札者負担です。</p>
        <button className="btn w-full">出品する</button>
      </form>
    </div>
  );
}
