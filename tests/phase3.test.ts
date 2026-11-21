import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "banshu-p3-"));
process.env.DATABASE_PATH = path.join(dir, "test.sqlite");
process.env.RANKS = "0:見習い,10000:常連,50000:上客";

const { getDb } = await import("../src/lib/db.ts");
const { createListing, placeBid, finalizeEnded, getListing, unlockListing, isUnlocked, canRevealMystery, buyNow } = await import("../src/lib/auctions.ts");
const { rankFor, userRank } = await import("../src/lib/ranks.ts");
const { issueSaleCertificate, applySecondaryCertificate, reviewSecondaryCertificate, getCertificate, lineage, myCertificates, pendingSecondaryCertificates } = await import("../src/lib/certificates.ts");
const { updateOrderStatus } = await import("../src/lib/sellers.ts");

let sellerId: number; let u1: number; let u2: number;
before(() => {
  const db = getDb();
  sellerId = Number(db.prepare("INSERT INTO sellers (name, slug) VALUES ('S', 's')").run().lastInsertRowid);
  u1 = Number(db.prepare("INSERT INTO users (email, status, name) VALUES ('p3a@example.com', 'approved', '甲')").run().lastInsertRowid);
  u2 = Number(db.prepare("INSERT INTO users (email, status, name) VALUES ('p3b@example.com', 'approved', '乙')").run().lastInsertRowid);
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));
const base = () => ({
  seller_id: sellerId, title: "S) 品種 1ペア", variety: "三色", breeder: "S", certificate: "", quantity: "", description: "", image_url: "",
  start_price: 1000, bid_increment: 100, starts_at: new Date(Date.now() - 1000).toISOString(), ends_at: new Date(Date.now() + 3600_000).toISOString(),
  featured: false, hot: false, sudden_death: false, shipping_fee: 500, shipping_method: "normal" as const, fee_rate: 10,
});

test("ランクは累計落札額（入金確認以降）で決まる", async () => {
  assert.equal(rankFor(0).name, "見習い");
  assert.equal(rankFor(9999).name, "見習い");
  assert.equal(rankFor(10000).name, "常連");
  assert.equal(rankFor(123456).name, "上客");
  assert.equal(userRank(u1).rank.level, 0);
  const id = await createListing({ ...base(), buyout_price: 12000 });
  await buyNow(id, u1);
  assert.equal(userRank(u1).total, 0); // 支払い待ちは含まない
  await updateOrderStatus(sellerId, id, "paid");
  const r = userRank(u1);
  assert.equal(r.total, 12000);
  assert.equal(r.rank.name, "常連");
  assert.equal(r.next!.name, "上客");
  assert.equal(r.toNext, 38000);
});

test("限定オークション：合言葉で解錠。間違いは拒否。合言葉なしは常に解錠", async () => {
  const id = await createListing({ ...base(), passphrase: " 播州 " });
  assert.ok(getListing(id)!.passphrase_hash);
  assert.equal(isUnlocked(u2, id), false);
  assert.equal(unlockListing(u2, id, "ばんしゅう"), false);
  assert.equal(isUnlocked(u2, id), false);
  assert.equal(unlockListing(u2, id, "播州"), true);
  assert.equal(isUnlocked(u2, id), true);
  const open = await createListing(base());
  assert.equal(unlockListing(u2, open, ""), true);
});

test("千両箱：落札者・出品者・管理者だけが中身を見られる", async () => {
  const id = await createListing({ ...base(), mystery: true });
  const l = getListing(id)!;
  assert.equal(l.mystery, 1);
  assert.equal(canRevealMystery(l, null, null), false);
  assert.equal(canRevealMystery(l, { id: u2, role: "user" }, null), false);
  assert.equal(canRevealMystery(l, { id: u2, role: "admin" }, null), true);
  assert.equal(canRevealMystery(l, { id: u2, role: "user" }, sellerId), true);
  await placeBid(id, u2, 1000);
  getDb().prepare("UPDATE listings SET ends_at = ? WHERE id = ?").run(new Date(Date.now() - 1000).toISOString(), id);
  await finalizeEnded();
  const ended = getListing(id)!;
  assert.equal(canRevealMystery(ended, { id: u2, role: "user" }, null), true);
  assert.equal(canRevealMystery(ended, { id: u1, role: "user" }, null), false);
  assert.equal(canRevealMystery({ ...ended, mystery: 0 }, null, null), true);
});

test("落札販売証明：入金確認後に落札者だけが発行。二次販売証明は申請→お店が発行し系図がつながる", async () => {
  const id = await createListing(base());
  await placeBid(id, u1, 2000);
  getDb().prepare("UPDATE listings SET ends_at = ? WHERE id = ?").run(new Date(Date.now() - 1000).toISOString(), id);
  await finalizeEnded();
  assert.equal(issueSaleCertificate(id, u2).ok, false);
  assert.equal(issueSaleCertificate(id, u1).ok, false); // 支払い待ち
  await updateOrderStatus(sellerId, id, "paid");
  const r = issueSaleCertificate(id, u1);
  assert.equal(r.ok, true);
  const cert = (r as { cert: { code: string; variety: string | null; price: number | null } }).cert;
  assert.match(cert.code, /^BM-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(cert.variety, "三色");
  assert.equal(cert.price, 1000);
  // 二重発行は同じものを返す
  const again = issueSaleCertificate(id, u1);
  assert.equal(again.ok && again.cert.code, cert.code);
  assert.equal(getCertificate(cert.code.toLowerCase())!.code, cert.code);
  // 二次販売証明
  assert.equal(applySecondaryCertificate(cert.code, u2, { title: "F1", note: "" }).ok, false);
  const ap = applySecondaryCertificate(cert.code, u1, { title: "三色 F1 1ペア", note: "春生まれ" });
  assert.equal(ap.ok, true);
  const child = (ap as { cert: { id: number; code: string; status: string } }).cert;
  assert.equal(child.status, "pending");
  assert.equal(pendingSecondaryCertificates().length, 1);
  assert.equal(applySecondaryCertificate(child.code, u1, { title: "孫", note: "" }).ok, false); // 未発行からは不可
  assert.equal(await reviewSecondaryCertificate(child.id, true), true);
  const issued = getCertificate(child.code)!;
  assert.equal(issued.status, "issued");
  const chain = lineage(issued);
  assert.equal(chain.length, 2);
  assert.equal(chain[1].code, cert.code);
  assert.equal(myCertificates(u1).length, 2);
  assert.ok(getDb().prepare("SELECT 1 FROM notifications WHERE user_id = ? AND message LIKE '%二次販売証明%'").get(u1));
});
