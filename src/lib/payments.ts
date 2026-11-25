import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { getDb, nowIso } from "./db.ts";
import { siteConfig } from "./config.ts";
import { getOrder, confirmOrderPaidBySystem } from "./sellers.ts";

export type Payment = {
  id: number;
  token: string;
  listing_id: number;
  buyer_id: number;
  seller_id: number;
  amount: number;
  provider: "stripe" | "mock";
  session_id: string | null;
  status: "pending" | "paid" | "cancelled";
  created_at: string;
  paid_at: string | null;
};

/** Stripe の秘密鍵があれば本番、なければモック決済で動く */
export function paymentProvider(): "stripe" | "mock" {
  return siteConfig.stripe.secretKey ? "stripe" : "mock";
}

export function getPayment(token: string): Payment | null {
  return (getDb().prepare("SELECT * FROM payments WHERE token = ?").get(token) as Payment | undefined) ?? null;
}

function genToken(): string {
  return "pay_" + randomBytes(16).toString("hex");
}

/**
 * 取引（order）のオンライン決済を開始する。
 * 返り値の url にリダイレクトすれば、ホスト型決済画面（Stripe Checkout）へ移る。
 * カード番号は決済事業者の画面で入力され、当サイトのサーバーを通らない。
 */
export async function startCheckout(listingId: number, buyerId: number): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const order = getOrder(listingId);
  if (!order) return { ok: false, error: "取引が見つかりません。" };
  if (order.buyer_id !== buyerId) return { ok: false, error: "この取引の落札者ではありません。" };
  if (order.status !== "awaiting_payment") return { ok: false, error: "この取引はお支払い待ちではありません。" };
  const amount = order.price + order.shipping_fee;
  const provider = paymentProvider();
  const token = genToken();
  const db = getDb();

  // 同じ取引の未完了の決済は作り直す
  db.prepare("DELETE FROM payments WHERE listing_id = ? AND status = 'pending'").run(listingId);

  if (provider === "mock") {
    db.prepare("INSERT INTO payments (token, listing_id, buyer_id, seller_id, amount, provider, status) VALUES (?, ?, ?, ?, ?, 'mock', 'pending')")
      .run(token, listingId, buyerId, order.seller_id, amount);
    return { ok: true, url: `${siteConfig.baseUrl}/pay/mock/${token}` };
  }

  const title = (db.prepare("SELECT title FROM listings WHERE id = ?").get(listingId) as { title: string }).title;
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("locale", "ja");
  body.set("success_url", `${siteConfig.baseUrl}/pay/return?token=${token}`);
  body.set("cancel_url", `${siteConfig.baseUrl}/mypage?tab=won&pay_cancelled=1`);
  body.set("client_reference_id", token);
  body.set("metadata[token]", token);
  body.set("metadata[listing_id]", String(listingId));
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", siteConfig.stripe.currency);
  body.set("line_items[0][price_data][unit_amount]", String(amount));
  body.set("line_items[0][price_data][product_data][name]", `${title}（落札代金＋送料）`.slice(0, 120));

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${siteConfig.stripe.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    console.error("Stripe checkout failed", res.status, await res.text().catch(() => ""));
    return { ok: false, error: "決済の開始に失敗しました。時間をおいて再度お試しください。" };
  }
  const session = (await res.json()) as { id: string; url: string };
  db.prepare("INSERT INTO payments (token, listing_id, buyer_id, seller_id, amount, provider, session_id, status) VALUES (?, ?, ?, ?, ?, 'stripe', ?, 'pending')")
    .run(token, listingId, buyerId, order.seller_id, amount, session.id);
  return { ok: true, url: session.url };
}

/** 決済完了を記録し、取引を入金確認済みにする（Webhook／モックから。idempotent） */
export async function markPaymentPaid(token: string, via: string): Promise<boolean> {
  const db = getDb();
  const p = getPayment(token);
  if (!p) return false;
  if (p.status !== "paid") {
    db.prepare("UPDATE payments SET status = 'paid', paid_at = ? WHERE token = ?").run(nowIso(), token);
  }
  await confirmOrderPaidBySystem(p.listing_id, via);
  return true;
}

/**
 * Stripe Webhook の署名を検証する。
 * ヘッダ Stripe-Signature の t と v1 を取り出し、HMAC-SHA256(`${t}.${payload}`) と比較する。
 */
export function verifyStripeSignature(payload: string, sigHeader: string, toleranceSec = 300): boolean {
  const secret = siteConfig.stripe.webhookSecret;
  if (!secret) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map((kv) => kv.split("=")) as [string, string][]);
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
