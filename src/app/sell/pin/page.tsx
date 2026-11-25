import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sellerContext } from "@/lib/seller-gate";
import { pinAction } from "../actions";

export const metadata: Metadata = { title: "出品者PIN認証" };
export const dynamic = "force-dynamic";

export default async function PinPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const { user, seller, pinOk } = await sellerContext();
  if (!user) redirect("/login?next=/sell");
  if (!seller) redirect("/sell");
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/sell/dashboard";
  if (pinOk) redirect(next);
  return (
    <div className="max-w-sm mx-auto card p-6 space-y-4">
      <h1 className="text-xl font-black text-accent-2">出品者認証</h1>
      <p className="text-sm text-muted">{seller.name} の出品者ページです。お店から通知されたPINコードを入力してください。</p>
      {sp.error && <p className="text-danger text-sm border border-danger/40 rounded p-2">{sp.error}</p>}
      <form action={pinAction} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <input name="pin" type="password" inputMode="numeric" autoComplete="one-time-code" placeholder="PINコード（8桁）" required autoFocus className="input text-center text-xl tracking-[0.4em]" />
        <button className="btn w-full">認証する</button>
      </form>
    </div>
  );
}
