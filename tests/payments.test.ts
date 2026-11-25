import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "banshu-pay-"));
process.env.DATABASE_PATH = path.join(dir, "test.sqlite");
delete process.env.STRIPE_SECRET_KEY; // モードをモックにする
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
process.env.BASE_URL = "http://localhost:3000";

const { getDb } = await import("../src/lib/db.ts");
const { createListing, placeBid, finalizeEnded } = await import("../src/lib/auctions.ts");
const { getOrder } = await import("../src/lib/sellers.ts");
const { startCheckout, getPayment, markPaymentPaid, paymentProvider, verifyStripeSignature } = await import("../src/lib/payments.ts");
const { createHmac } = await import("node:crypto");

let sellerId: number; let buyer: number; let other: number; let listingId: number;
before(async () => {
  const db = getDb();
  sellerId = Number(db.prepare("INSERT INTO sellers (name, slug, accepts_online) VALUES ('S', 's', 1)").run().lastInsertRowid);
  buyer = Number(db.prepare("INSERT INTO users (email, status, name) VALUES ('b@example.com', 'approved', '甲')").run().lastInsertRowid);
  other = Number(db.prepare("INSERT INTO users (email, status, name) VALUES ('o@example.com', 'approved', '乙')").run().lastInsertRowid);
  listingId = await createListing({
    seller_id: sellerId, title: "S) 品 1ペア", variety: "", breeder: "", certificate: "", quantity: "", description: "", image_url: "",
    start_price: 2000, bid_increment: 100, starts_at: new Date(Date.now() - 1000).toISOString(), ends_at: new Date(Date.now() + 1000).toISOString(),
    featured: false, hot: false, sudden_death: false, shipping_fee: 500, shipping_method: "normal", fee_rate: 10,
  });
  await placeBid(listingId, buyer, 2000);
  db.prepare("UPDATE listings SET ends_at = ? WHERE id = ?").run(new Date(Date.now() - 1000).toISOString(), listingId);
  await finalizeEnded();
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

test("鍵が無ければモックモード", () => {
  assert.equal(paymentProvider(), "mock");
});

test("落札者だけが決済を開始でき、金額は落札額＋送料", async () => {
  assert.equal(getOrder(listingId)!.status, "awaiting_payment");
  const bad = await startCheckout(listingId, other);
  assert.equal(bad.ok, false);
  const r = await startCheckout(listingId, buyer);
  assert.equal(r.ok, true);
  const url = (r as { url: string }).url;
  assert.match(url, /\/pay\/mock\/pay_[0-9a-f]+$/);
  const token = url.split("/").pop()!;
  const p = getPayment(token)!;
  assert.equal(p.amount, 2500);
  assert.equal(p.provider, "mock");
  assert.equal(p.status, "pending");
});

test("決済完了で取引が入金確認済みになり、落札者に通知。二重でも安全", async () => {
  const r = await startCheckout(listingId, buyer);
  const token = (r as { url: string }).url.split("/").pop()!;
  assert.equal(await markPaymentPaid(token, "mock"), true);
  const o = getOrder(listingId)!;
  assert.equal(o.status, "paid");
  assert.equal(o.paid_via, "mock");
  assert.ok(o.paid_at);
  assert.equal(getPayment(token)!.status, "paid");
  const notes = getDb().prepare("SELECT 1 FROM notifications WHERE user_id = ? AND listing_id = ? AND message LIKE '%オンライン決済%'").all(buyer, listingId);
  assert.equal(notes.length, 1);
  // 二重呼び出しは何も壊さない（既に paid なので状態は変わらない）
  assert.equal(await markPaymentPaid(token, "mock"), true);
  assert.equal(getOrder(listingId)!.status, "paid");
  // 支払い済みの取引は再決済を開始できない
  const again = await startCheckout(listingId, buyer);
  assert.equal(again.ok, false);
});

test("Stripe Webhook 署名検証：正しい署名のみ通す", () => {
  const payload = JSON.stringify({ type: "checkout.session.completed" });
  const t = Math.floor(Date.now() / 1000);
  const good = createHmac("sha256", "whsec_test").update(`${t}.${payload}`).digest("hex");
  assert.equal(verifyStripeSignature(payload, `t=${t},v1=${good}`), true);
  assert.equal(verifyStripeSignature(payload, `t=${t},v1=deadbeef`), false);
  assert.equal(verifyStripeSignature(payload, `t=${t - 10000},v1=${good}`), false); // 期限切れ
  assert.equal(verifyStripeSignature(payload, "garbage"), false);
});
