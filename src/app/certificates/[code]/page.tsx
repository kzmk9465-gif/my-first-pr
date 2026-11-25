import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { children, getCertificate, lineage } from "@/lib/certificates";
import { getCurrentUser } from "@/lib/auth";
import { siteConfig } from "@/lib/config";
import { formatDateTime, yen } from "@/lib/format";
import { applySecondaryAction } from "./actions";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ error?: string; applied?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `証明書 ${(await params).code}` };
}

export default async function CertificatePage({ params, searchParams }: Props) {
  const { code } = await params;
  const sp = await searchParams;
  const cert = getCertificate(decodeURIComponent(code));
  if (!cert) notFound();
  const user = await getCurrentUser();
  const mine = !!user && user.id === cert.user_id;
  const chain = lineage(cert);
  const kids = children(cert);
  const valid = cert.status === "issued";

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className={`card p-6 space-y-4 ${valid ? "border-accent/60" : ""}`} style={{ background: "linear-gradient(160deg, #141b33, #0e1428)" }}>
        <div className="text-center">
          <div className="text-[10px] tracking-[0.5em] text-muted">{siteConfig.auctionNameEn}</div>
          <h1 className="text-2xl font-black text-accent-2 tracking-widest">{cert.type === "sale" ? "落札販売証明書" : "二次販売証明書"}</h1>
          <div className="mt-1 font-mono text-lg tracking-widest">{cert.code}</div>
          <div className="mt-1">
            {valid ? <span className="badge badge-ok">✓ 有効（公式照合済み）</span> : cert.status === "pending" ? <span className="badge badge-hot">お店の確認待ち</span> : <span className="badge">無効</span>}
          </div>
        </div>
        <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
          <dt className="text-muted">個体</dt><dd className="font-bold">{cert.title}</dd>
          {cert.variety && (<><dt className="text-muted">品種</dt><dd>{cert.variety}</dd></>)}
          {cert.breeder && (<><dt className="text-muted">作出者</dt><dd>{cert.breeder}</dd></>)}
          {cert.seller_name && (<><dt className="text-muted">{cert.type === "sale" ? "出品者" : "販売者"}</dt><dd>{cert.seller_name}</dd></>)}
          <dt className="text-muted">所有者</dt><dd>{cert.holder_name ?? "（会員）"}</dd>
          {cert.price != null && (<><dt className="text-muted">落札価格</dt><dd>{yen(cert.price)}</dd></>)}
          {cert.listing_id && (<><dt className="text-muted">出品</dt><dd><Link href={`/auctions/${cert.listing_id}`} className="underline">ID:{cert.listing_id}</Link></dd></>)}
          {cert.note && (<><dt className="text-muted">備考</dt><dd className="whitespace-pre-wrap">{cert.note}</dd></>)}
          <dt className="text-muted">発行日</dt><dd>{cert.issued_at ? formatDateTime(cert.issued_at) : "-"}</dd>
        </dl>
        <p className="text-[11px] text-muted text-center">この証明書は {siteConfig.name} が発行し、証明番号から本サイト上で照合できます（{siteConfig.baseUrl}/certificates/{cert.code}）。</p>
      </div>

      {chain.length > 1 && (
        <div className="card p-4 text-sm">
          <h2 className="font-bold text-accent-2 mb-2">系図（本家へのつながり）</h2>
          <ol className="space-y-1">
            {chain.map((c, i) => (
              <li key={c.id} className="flex items-center gap-2">
                <span className="text-muted">{i === 0 ? "この証明" : "└ 親".padStart(i + 2, "　")}</span>
                <Link href={`/certificates/${c.code}`} className="underline font-mono">{c.code}</Link>
                <span>{c.title}</span><span className="text-muted text-xs">{c.holder_name}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {kids.length > 0 && (
        <div className="card p-4 text-sm">
          <h2 className="font-bold text-accent-2 mb-2">この証明から発行された二次販売証明（{kids.length}）</h2>
          <ul className="space-y-1">{kids.map((c) => <li key={c.id}><Link href={`/certificates/${c.code}`} className="underline font-mono">{c.code}</Link> {c.title}</li>)}</ul>
        </div>
      )}

      {mine && valid && (
        <div className="card p-4 text-sm space-y-2">
          <h2 className="font-bold text-accent-2">殖やした子を売るとき（二次販売証明の申請）</h2>
          <p className="text-xs text-muted">この個体から殖やした子を販売する際に、血統のつながりを示す二次販売証明を申請できます。お店が確認してから発行されます。{siteConfig.secondaryCertFee > 0 ? `発行料 1枚 ${yen(siteConfig.secondaryCertFee)}。` : "発行は無料です。"}</p>
          {sp.error && <p className="text-danger text-xs border border-danger/40 rounded p-2">{sp.error}</p>}
          {sp.applied && <p className="text-ok text-xs border border-ok/40 rounded p-2">申請を受け付けました（{sp.applied}）。お店の確認をお待ちください。</p>}
          <form action={applySecondaryAction} className="space-y-2">
            <input type="hidden" name="parent" value={cert.code} />
            <input name="title" required className="input" placeholder="例: 三色ラメ幹之 F1 1ペア（2026年春生まれ）" />
            <textarea name="note" rows={2} className="input" placeholder="備考（販売先、サイズなど・任意）" />
            <button className="btn">二次販売証明を申請する</button>
          </form>
        </div>
      )}
      <div className="text-center text-xs"><Link href="/mypage#certs" className="underline text-muted">マイ証明一覧へ</Link></div>
    </div>
  );
}
