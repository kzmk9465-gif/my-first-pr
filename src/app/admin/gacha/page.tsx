import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { GACHA_COST, MISS_WEIGHT, listPrizes, wonResults } from "@/lib/gacha";
import { formatDateTime } from "@/lib/format";
import { addPrizeAction, fulfillPrizeAction, prizeActiveAction } from "../actions";

export const metadata: Metadata = { title: "ガチャの管理" };
export const dynamic = "force-dynamic";

export default async function AdminGachaPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/gacha");
  if (user.role !== "admin") redirect("/auctions");
  const sp = await searchParams;
  const prizes = listPrizes();
  const won = wonResults();
  const total = MISS_WEIGHT + prizes.filter((p) => p.active && (p.stock == null || p.stock > 0)).reduce((a, p) => a + p.weight, 0);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-accent-2">ガチャの管理</h1>
      <p className="text-xs text-muted">会員はログインボーナス（1日1ポイント）を貯め、{GACHA_COST}ポイントで1回回せます。はずれの重みは {MISS_WEIGHT}（GACHA_MISS_WEIGHT で変更）。当選確率 = 景品の重み ÷ {total}。</p>
      {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}
      {sp.saved && <p className="text-ok text-sm border border-ok/40 rounded p-2">景品を追加しました。</p>}
      <form action={addPrizeAction} className="card p-4 grid gap-2 md:grid-cols-4 text-sm">
        <input name="name" required className="input md:col-span-2" placeholder="景品名（例: ENNMA風 餌サンプル、稚魚5匹）" />
        <input name="weight" type="number" min={1} defaultValue={5} className="input" placeholder="重み" />
        <input name="stock" type="number" min={0} className="input" placeholder="在庫（空欄で無制限）" />
        <button className="btn md:col-span-4">景品を追加</button>
      </form>
      <div className="card divide-y divide-accent/10 text-sm">
        {prizes.map((p) => (
          <div key={p.id} className="p-3 flex justify-between gap-2">
            <span>{p.name} <span className="text-xs text-muted">重み {p.weight}（約 {total > 0 ? ((100 * p.weight) / total).toFixed(1) : 0}%） ・ 在庫 {p.stock ?? "∞"}</span>{!p.active && <span className="badge ml-1">停止中</span>}</span>
            <form action={prizeActiveAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={p.active ? "0" : "1"} /><button className="btn btn-outline !py-1 text-xs">{p.active ? "停止" : "再開"}</button></form>
          </div>
        ))}
        {prizes.length === 0 && <p className="p-4 text-muted">景品がありません。追加するまで「はずれ」しか出ません。</p>}
      </div>
      <h2 className="font-bold text-accent-2">当選者（景品の発送）</h2>
      <div className="card divide-y divide-accent/10 text-sm">
        {won.map((r) => (
          <div key={r.id} className="p-3 flex flex-wrap justify-between gap-2">
            <div><b>{r.prize_name}</b> → {r.name ?? ""} &lt;{r.email}&gt;<div className="text-xs text-muted">{r.shipping_address ?? "発送先未登録"} ・ {formatDateTime(r.created_at)}</div></div>
            {r.fulfilled ? <span className="badge badge-ok">発送済み</span> : <form action={fulfillPrizeAction}><input type="hidden" name="id" value={r.id} /><button className="btn !py-1 text-xs">発送済みにする</button></form>}
          </div>
        ))}
        {won.length === 0 && <p className="p-4 text-muted">当選はまだありません。</p>}
      </div>
    </div>
  );
}
