import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "banshu-test-"));
process.env.DATABASE_PATH = path.join(dir, "test.sqlite");
process.env.AUTO_EXTEND_SECONDS = "300";
process.env.AUTO_EXTEND_WINDOW_SECONDS = "300";

const { getDb } = await import("../src/lib/db.ts");
const { placeBid, finalizeEnded, getListing, minimumBid, toggleFollow, isFollowing, createListing } = await import("../src/lib/auctions.ts");

let sellerId: number;
let u1: number;
let u2: number;

before(() => {
  const db = getDb();
  sellerId = Number(db.prepare("INSERT INTO sellers (name, slug) VALUES ('t', 't')").run().lastInsertRowid);
  u1 = Number(db.prepare("INSERT INTO users (email) VALUES ('a@example.com')").run().lastInsertRowid);
  u2 = Number(db.prepare("INSERT INTO users (email) VALUES ('b@example.com')").run().lastInsertRowid);
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

function mk(endsInMs: number, startPrice = 1000) {
  return createListing({
    seller_id: sellerId, title: "test", variety: "", breeder: "", certificate: "", quantity: "", description: "", image_url: "",
    start_price: startPrice, bid_increment: 100,
    starts_at: new Date(Date.now() - 1000).toISOString(), ends_at: new Date(Date.now() + endsInMs).toISOString(),
    featured: false, hot: false,
  });
}

test("first bid must be at least start price, then increment applies", async () => {
  const id = await mk(3600_000);
  assert.equal(minimumBid(getListing(id)!), 1000);
  let r = await placeBid(id, u1, 900);
  assert.equal(r.ok, false);
  r = await placeBid(id, u1, 1000);
  assert.equal(r.ok, true);
  assert.equal(minimumBid(getListing(id)!), 1100);
  r = await placeBid(id, u2, 1050);
  assert.equal(r.ok, false); // 単位違反
  r = await placeBid(id, u2, 1100);
  assert.equal(r.ok, true);
  const l = getListing(id)!;
  assert.equal(l.current_price, 1100);
  assert.equal(l.bid_count, 2);
  assert.equal(l.extended_count, 0);
});

function setEndsIn(id: number, ms: number) {
  const iso = new Date(Date.now() + ms).toISOString();
  getDb().prepare("UPDATE listings SET ends_at = ? WHERE id = ?").run(iso, id);
  return iso;
}

test("bid in the last minutes extends the end time and notifies the outbid user", async () => {
  const id = await mk(3600_000);
  await placeBid(id, u1, 1000);
  assert.equal(getListing(id)!.extended_count, 0);
  const before = setEndsIn(id, 60_000);
  const r = await placeBid(id, u2, 1100);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.extended, true);
  const l = getListing(id)!;
  assert.ok(l.ends_at > before);
  assert.equal(l.extended_count, 1);
  const notes = getDb().prepare("SELECT * FROM notifications WHERE user_id = ? AND type = 'outbid' AND listing_id = ?").all(u1, id);
  assert.equal(notes.length, 1);
});

test("finalizeEnded sets winner and sends won notification; late bids are rejected", async () => {
  const id = await mk(3600_000);
  await placeBid(id, u1, 1000);
  await placeBid(id, u2, 1200);
  setEndsIn(id, -1000);
  const late = await placeBid(id, u1, 1300);
  assert.equal(late.ok, false);
  const n = await finalizeEnded();
  assert.ok(n >= 1);
  const l = getListing(id)!;
  assert.equal(l.status, "ended");
  assert.equal(l.winner_id, u2);
  const won = getDb().prepare("SELECT * FROM notifications WHERE user_id = ? AND type = 'won' AND listing_id = ?").all(u2, id);
  assert.equal(won.length, 1);
});

test("ended listing without bids has no winner", async () => {
  const id = await mk(100);
  await new Promise((r) => setTimeout(r, 200));
  await finalizeEnded();
  const l = getListing(id)!;
  assert.equal(l.status, "ended");
  assert.equal(l.winner_id, null);
});

test("follow toggles and followers get new-listing notifications", async () => {
  assert.equal(toggleFollow(u1, sellerId), true);
  assert.equal(isFollowing(u1, sellerId), true);
  await mk(3600_000);
  const notes = getDb().prepare("SELECT * FROM notifications WHERE user_id = ? AND type = 'new_listing'").all(u1);
  assert.equal(notes.length, 1);
  assert.equal(toggleFollow(u1, sellerId), false);
});

test("myBids returns the user's max bid per listing", async () => {
  const { myBids } = await import("../src/lib/auctions.ts");
  const id = await mk(3600_000);
  await placeBid(id, u1, 1000);
  await placeBid(id, u2, 1100);
  await placeBid(id, u1, 1300);
  const mine = myBids(u1).find((l) => l.id === id)!;
  assert.equal(mine.my_max, 1300);
  assert.equal(mine.current_price, 1300);
  assert.equal(myBids(u2).find((l) => l.id === id)!.my_max, 1100);
});
