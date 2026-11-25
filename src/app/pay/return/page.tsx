import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPayment, markPaymentPaid, paymentProvider } from "@/lib/payments";
import { getCurrentUser } from "@/lib/auth";
import { yen } from "@/lib/format";

export const metadata: Metadata = { title: "お支払い" };
export const dynamic = "force-dynamic";

export default async function PayReturnPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const p = token ? getPayment(token) : null;
  if (!p) redirect("/mypage?tab=won");
  const user = await getCurrentUser();
  if (!user || user.id !== p.buyer_id) redirect("/login?next=/mypage");

  // Stripe の場合、Webhook 到着前でも照合して確定（二重でも idempotent）
  if (p.status !== "paid" && paymentProvider() === "stripe" && p.session_id) {
    await reconcileStripe(p.session_id, token!);
  }
  const fresh = getPayment(token!)!;
  const paid = fresh.status === "paid";

  return (
    <div className="max-w-md mx-auto card p-6 text-center space-y-4">
      {paid ? (
        <>
          <div className="text-4xl">✅</div>
          <h1 className="text-xl font-black text-accent-2">お支払いが完了しました</h1>
          <p className="text-sm text-muted">{yen(fresh.amount)} のお支払いを受け付けました。入金確認として取引に反映しました。発送までお待ちください。</p>
        </>
      ) : (
        <>
          <div className="text-4xl">⏳</div>
          <h1 className="text-xl font-black text-accent-2">お支払いを確認しています</h1>
          <p className="text-sm text-muted">決済の確認に少し時間がかかる場合があります。反映されない場合はしばらくしてマイページをご確認ください。</p>
        </>
      )}
      <Link href={`/auctions/${fresh.listing_id}`} className="btn btn-outline">出品ページ</Link>
      <Link href="/mypage?tab=won" className="btn">マイページの「落札分」へ</Link>
    </div>
  );
}

async function reconcileStripe(sessionId: string, token: string): Promise<void> {
  try {
    const { siteConfig } = await import("@/lib/config");
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${siteConfig.stripe.secretKey}` },
    });
    if (!res.ok) return;
    const s = (await res.json()) as { payment_status?: string };
    if (s.payment_status === "paid") await markPaymentPaid(token, "stripe");
  } catch {
    /* Webhook 側で確定する */
  }
}
