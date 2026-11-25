import type { Metadata } from "next";
import Link from "next/link";
import { TRAIT_GROUPS, searchVarieties, traitsOf } from "@/lib/zukan";

export const metadata: Metadata = { title: "メダカ図鑑" };
export const dynamic = "force-dynamic";

export default async function ZukanPage({ searchParams }: { searchParams: Promise<{ q?: string; t?: string | string[] }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 50);
  const traits = (Array.isArray(sp.t) ? sp.t : sp.t ? [sp.t] : []).slice(0, 10);
  const items = searchVarieties({ keyword: q, traits });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black text-accent-2">メダカ図鑑</h1>
          <p className="text-xs text-muted">品種とブリーダーのデータベース。形質を組み合わせて検索できます。</p>
        </div>
        <Link href="/zukan/new" className="btn btn-outline">＋ 品種を登録</Link>
      </div>
      <form method="get" className="card p-4 space-y-3 text-sm">
        <div className="flex gap-2"><input name="q" defaultValue={q} className="input" placeholder="品種名・作出者・説明で検索" /><button className="btn">検索</button></div>
        <div className="grid gap-2 sm:grid-cols-2">
          {TRAIT_GROUPS.map((g) => (
            <fieldset key={g.key} className="border border-accent/10 rounded p-2">
              <legend className="text-xs text-muted px-1">{g.label}</legend>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {g.items.map((t) => <label key={t} className="flex items-center gap-1"><input type="checkbox" name="t" value={t} defaultChecked={traits.includes(t)} />{t}</label>)}
              </div>
            </fieldset>
          ))}
        </div>
        {(q || traits.length > 0) && <Link href="/zukan" className="text-xs underline text-muted">条件を解除</Link>}
      </form>
      <p className="text-xs text-muted">{items.length} 品種</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((v) => (
          <Link key={v.id} href={`/zukan/${v.id}`} className="card overflow-hidden hover:border-accent/50">
            <div className="aspect-[4/3] bg-surface-2 flex items-center justify-center">
              {v.image_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.image_url} alt={v.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-muted text-sm">画像なし</span>}
            </div>
            <div className="p-3">
              <div className="font-bold">{v.name}</div>
              <div className="text-xs text-muted">{v.breeder_name ?? "作出者不明"}{v.prefecture && ` ・ ${v.prefecture}`}</div>
              <div className="mt-1 flex flex-wrap gap-1">{traitsOf(v).slice(0, 5).map((t) => <span key={t} className="badge">{t}</span>)}</div>
            </div>
          </Link>
        ))}
        {items.length === 0 && <p className="card p-6 text-muted text-sm sm:col-span-3">該当する品種はありません。</p>}
      </div>
    </div>
  );
}
