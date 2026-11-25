import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVariety, traitsOf } from "@/lib/zukan";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { const v = getVariety(Number((await params).id)); return { title: v ? `${v.name} | メダカ図鑑` : "メダカ図鑑" }; }

export default async function VarietyPage({ params }: Props) {
  const v = getVariety(Number((await params).id));
  if (!v) notFound();
  const user = await getCurrentUser();
  if (v.status !== "approved" && !(user && (user.role === "admin" || user.id === v.user_id))) notFound();
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <nav className="text-xs text-muted"><Link href="/zukan" className="hover:text-accent-2">メダカ図鑑</Link> › {v.name}</nav>
      <div className="card overflow-hidden">
        <div className="aspect-[4/3] bg-surface-2 flex items-center justify-center">
          {v.image_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.image_url} alt={v.name} className="h-full w-full object-contain" /> : <span className="text-muted">画像なし</span>}
        </div>
        <div className="p-4 space-y-3">
          <h1 className="text-2xl font-black text-accent-2">{v.name} {v.status !== "approved" && <span className="badge badge-hot">承認待ち</span>}</h1>
          <div className="flex flex-wrap gap-1">{traitsOf(v).map((t) => <span key={t} className="badge badge-star">{t}</span>)}</div>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
            <dt className="text-muted">作出者</dt><dd>{v.breeder_name ?? "-"}</dd>
            <dt className="text-muted">都道府県</dt><dd>{v.prefecture ?? "-"}</dd>
            <dt className="text-muted">Instagram</dt><dd>{v.instagram ? <a className="underline" href={`https://www.instagram.com/${v.instagram}/`} target="_blank" rel="noreferrer">@{v.instagram}</a> : "-"}</dd>
          </dl>
          {v.description && <p className="text-sm whitespace-pre-wrap border-t border-accent/10 pt-3">{v.description}</p>}
          <Link href={`/auctions?q=${encodeURIComponent(v.name)}`} className="btn btn-outline">この品種の出品を探す</Link>
        </div>
      </div>
    </div>
  );
}
