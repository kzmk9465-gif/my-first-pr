import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "banshu-sellers-"));
process.env.DATABASE_PATH = path.join(dir, "test.sqlite");
process.env.UPLOAD_DIR = path.join(dir, "uploads");

const { getDb } = await import("../src/lib/db.ts");
const { createListing, buyNow, placeBid, getListing, publishListing, reviewListings, listListings, finalizeEnded, listingImages } = await import("../src/lib/auctions.ts");
const { getOrder, updateOrderStatus, completeOrderByBuyer, feeBreakdown, sellerSummary, saveTemplate, listTemplates, deleteTemplate, setSellerPin, verifySellerPin, getSellerById, updateSellerAccount, getSellerForUser } = await import("../src/lib/sellers.ts");
const { saveImage, readUpload } = await import("../src/lib/uploads.ts");

let sellerId: number; let buyer: number; let other: number; let sellerUser: number;
before(() => {
  const db = getDb();
  sellerId = Number(db.prepare("INSERT INTO sellers (name, slug, fee_rate, shipping_normal, shipping_cool) VALUES ('出品者X', 'x', 10, 1000, 1500)").run().lastInsertRowid);
  buyer = Number(db.prepare("INSERT INTO users (email, status) VALUES ('buyer@example.com', 'approved')").run().lastInsertRowid);
  other = Number(db.prepare("INSERT INTO users (email, status) VALUES ('other@example.com', 'approved')").run().lastInsertRowid);
  sellerUser = Number(db.prepare("INSERT INTO users (email, status) VALUES ('seller@example.com', 'approved')").run().lastInsertRowid);
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const base = () => ({
  seller_id: sellerId, title: "X) 品種 1ペア", variety: "", breeder: "", certificate: "", quantity: "", description: "", image_url: "",
  start_price: 1000, bid_increment: 100, starts_at: new Date(Date.now() - 1000).toISOString(), ends_at: new Date(Date.now() + 3600_000).toISOString(),
  featured: false, hot: false, sudden_death: false, shipping_method: "normal" as const, shipping_fee: 1000, fee_rate: 10,
});

test("フロント出品は確認待ちで非公開。公開すると一覧に出てフォロワーへ通知", async () => {
  getDb().prepare("INSERT INTO follows (user_id, seller_id) VALUES (?, ?)").run(other, sellerId);
  const id = await createListing({ ...base(), needs_review: true, created_by: sellerUser });
  assert.equal(getListing(id)!.status, "review");
  assert.ok(!listListings({ tab: "open" }).items.some((l) => l.id === id));
  assert.ok(reviewListings().some((l) => l.id === id));
  assert.equal((getDb().prepare("SELECT COUNT(*) c FROM notifications WHERE type='new_listing' AND listing_id=?").get(id) as { c: number }).c, 0);
  assert.equal(await publishListing(id), true);
  assert.equal(getListing(id)!.status, "open");
  assert.ok(listListings({ tab: "open" }).items.some((l) => l.id === id));
  assert.equal((getDb().prepare("SELECT COUNT(*) c FROM notifications WHERE type='new_listing' AND listing_id=?").get(id) as { c: number }).c, 1);
  assert.equal(await publishListing(id), false);
});

test("即決：現在価格が即決未満なら即終了して取引を作る。達していれば不可", async () => {
  const id = await createListing({ ...base(), buyout_price: 5000 });
  await placeBid(id, other, 1200);
  const r = await buyNow(id, buyer);
  assert.equal(r.ok, true);
  const l = getListing(id)!;
  assert.equal(l.status, "ended");
  assert.equal(l.winner_id, buyer);
  assert.equal(l.current_price, 5000);
  const o = getOrder(id)!;
  assert.equal(o.status, "awaiting_payment");
  assert.equal(o.price, 5000);
  assert.equal(o.shipping_fee, 1000);
  assert.equal(o.fee_rate, 10);
  assert.equal((await buyNow(id, other)).ok, false);
  // 即決価格が開始価格以下なら保存されない
  const id2 = await createListing({ ...base(), buyout_price: 900 });
  assert.equal(getListing(id2)!.buyout_price, null);
});

test("通常終了でも取引が作られ、ステータスは順に進む。発送で通知", async () => {
  const id = await createListing(base());
  await placeBid(id, buyer, 2000);
  getDb().prepare("UPDATE listings SET ends_at = ? WHERE id = ?").run(new Date(Date.now() - 1000).toISOString(), id);
  await finalizeEnded();
  const o = getOrder(id)!;
  assert.equal(o.buyer_id, buyer);
  assert.equal(o.price, 1000);
  // 別の出品者は操作できない
  assert.equal((await updateOrderStatus(sellerId + 999, id, "paid")).ok, false);
  // 支払い待ち → 発送済みへ飛ぶのは不可
  assert.equal((await updateOrderStatus(sellerId, id, "shipped")).ok, false);
  assert.equal((await updateOrderStatus(sellerId, id, "paid")).ok, true);
  assert.equal((await updateOrderStatus(sellerId, id, "shipped", { carrier: "ヤマト運輸", tracking_no: "1234-5678" })).ok, true);
  const o2 = getOrder(id)!;
  assert.equal(o2.status, "shipped");
  assert.equal(o2.tracking_no, "1234-5678");
  assert.ok(o2.shipped_at);
  const notes = getDb().prepare("SELECT message FROM notifications WHERE user_id=? AND listing_id=? ORDER BY id").all(buyer, id) as { message: string }[];
  assert.ok(notes.some((n) => n.message.includes("発送しました") && n.message.includes("1234-5678")));
  // 落札者が受け取り完了
  assert.equal(completeOrderByBuyer(other, id), false);
  assert.equal(completeOrderByBuyer(buyer, id), true);
  assert.equal(getOrder(id)!.status, "completed");
});

test("手数料計算と出品者集計", () => {
  assert.deepEqual(feeBreakdown(5000, 10), { fee: 500, payout: 4500 });
  assert.deepEqual(feeBreakdown(1234, 30), { fee: 370, payout: 864 });
  const s = sellerSummary(sellerId);
  assert.equal(s.sold_count, 2);
  assert.equal(s.gross, 6000);
  assert.equal(s.fee, 600);
  assert.equal(s.payout, 5400);
});

test("テンプレートは10件まで", () => {
  for (let i = 0; i < 10; i++) assert.equal(saveTemplate(sellerId, `t${i}`, "本文").ok, true);
  assert.equal(saveTemplate(sellerId, "t10", "本文").ok, false);
  const first = listTemplates(sellerId).at(-1)!;
  deleteTemplate(sellerId, first.id);
  assert.equal(listTemplates(sellerId).length, 9);
  assert.equal(saveTemplate(sellerId, "again", "本文").ok, true);
});

test("PINと会員紐づけ", () => {
  updateSellerAccount(sellerId, { user_id: sellerUser, fee_rate: 30, pin: "12345678" });
  const s = getSellerById(sellerId)!;
  assert.equal(s.fee_rate, 30);
  assert.equal(verifySellerPin(s, "12345678"), true);
  assert.equal(verifySellerPin(s, "00000000"), false);
  assert.equal(getSellerForUser(sellerUser)!.id, sellerId);
  setSellerPin(sellerId, "87654321");
  assert.equal(verifySellerPin(getSellerById(sellerId)!, "87654321"), true);
});

test("画像アップロードは形式とマジックバイトを検証し、WebPに変換して保存後に読み出せる", async () => {
  // 実際にデコード可能なPNGを用意（パイプラインがWebPへ変換する）
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } } }).png().toBuffer();
  const ok = await saveImage(new File([png], "a.png", { type: "image/png" }));
  assert.equal(ok.ok, true);
  const name = (ok as { url: string }).url.split("/").pop()!;
  assert.match(name, /\.webp$/); // 保存は常にWebP
  assert.equal(readUpload(name)!.type, "image/webp");

  // マジックバイトが画像として読めない入力は保存前に弾く
  const bad = await saveImage(new File([Buffer.alloc(40)], "a.png", { type: "image/png" }));
  assert.equal(bad.ok, false);
  // 対応外のMIMEタイプも弾く
  const badType = await saveImage(new File([png], "a.svg", { type: "image/svg+xml" }));
  assert.equal(badType.ok, false);
  assert.equal(readUpload("../etc/passwd"), null);
  const l = { images: JSON.stringify(["/api/uploads/x.png", "/api/uploads/y.png"]), image_url: "/api/uploads/x.png" };
  assert.deepEqual(listingImages(l), ["/api/uploads/x.png", "/api/uploads/y.png"]);
});
