import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "登録完了" };
export const dynamic = "force-dynamic";

export default async function RegisterDonePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/auctions";
  return (
    <div className="max-w-lg mx-auto card p-6 text-center space-y-4">
      <h1 className="text-xl font-black text-accent-2">登録ありがとうございます</h1>
      {user.status === "approved" ? (
        <p className="text-sm">承認済みです。すぐに入札できます。</p>
      ) : user.status === "blocked" ? (
        <p className="text-sm text-danger">このアカウントは現在ご利用いただけません。お問い合わせください。</p>
      ) : (
        <p className="text-sm text-muted">お店が内容を確認して承認するまで少しお待ちください。承認されるとお知らせ（LINE連携済みならLINE）が届きます。それまでも出品の閲覧やお気に入り、フォローはご利用いただけます。</p>
      )}
      <Link href={next} className="btn">会場へ</Link>
    </div>
  );
}
