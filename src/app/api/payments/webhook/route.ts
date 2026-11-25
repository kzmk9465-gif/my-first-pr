import { NextResponse } from "next/server";
import { markPaymentPaid, verifyStripeSignature } from "@/lib/payments";
import { siteConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Stripe Checkout の決済完了 Webhook。署名を検証し、取引を入金確認済みにする。 */
export async function POST(req: Request) {
  if (!siteConfig.stripe.webhookSecret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  if (!verifyStripeSignature(payload, sig)) return NextResponse.json({ error: "bad signature" }, { status: 400 });

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }
  if (event.type === "checkout.session.completed") {
    const obj = event.data.object as { client_reference_id?: string; metadata?: { token?: string }; payment_status?: string };
    const token = obj.metadata?.token ?? obj.client_reference_id;
    if (token && obj.payment_status === "paid") await markPaymentPaid(token, "stripe");
  }
  return NextResponse.json({ received: true });
}
