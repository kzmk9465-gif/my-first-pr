import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "banshu-test-"));
process.env.DATABASE_PATH = path.join(dir, "test.sqlite");
process.env.AUTO_EXTEND_SECONDS = "300";
process.env.AUTO_EXTEND_WINDOW_SECONDS = "300";
process.env.MIN_EXTEND_SECONDS = "60";

const { getDb } = await import("../src/lib/db.ts");
const {
  placeBid, finalizeEnded, getListing, minimumBid, toggleFollow, isFollowing, createListing,
  bidStatus, myLostBids, myBids, toggleFavorite, myFavorites, listListings, extensionSeconds, getBids,
} = await import("../src/lib/auctions.ts");

let sellerId: number;
let u1: number;
let u2: number;
let u3: number;

before(() => {
  const db = getDb();
  sellerId = Number(db.prepare("INSERT INTO sellers (name, slug) VALUES ('テスト出品者', 't')").run().lastInsertRowid);
  u1 = Number(db.prepare("INSERT INTO users (email, status) VALUES ('a@example.com', 'approved')").run().lastInsertRowid);
  u2 = Number(db.prepare("INSERT INTO users (email, status) VALUES ('b@example.com', 'approved')").run().lastInsertRowid);
  u3 = Number(db.prepare("INSERT INTO users (email, status) VALUES ('c@example.com', 'approved')").run().lastInsertRowid);
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

function mk(endsInMs: number, opts: { startPrice?: number; sudden?: boolean; title?: string } = {}) {
  return createListing({
    seller_id: sellerId, title: opts.title ?? "テスト 三色ラメ 1ペア", variety: "", breeder: "", certificate: "", quantity: "", description: "", image_url: "",
    start_price: opts.startPrice ?? 1000, bid_increment: 100,
    starts_at: new Date(Date.now() - 1000).toISOString(), ends_at: new Date(Date.now() + endsInMs).toISOString(),
    featured: false, hot: false, sudden_death: opts.sudden ?? false,
  });
}
function setEndsIn(id: number, ms: number) {
  const iso = new Date(Date.now() + ms).toISOString();
  getDb().prepare("UPDATE listings SET ends_at = ? WHERE id = ?").run(iso, id);
  return iso;
}
function ok(r: Awaited<ReturnType<typeof placeBid>>) {
  assert.equal(r.ok, true, r.ok ? "" : r.error);
  return r as Extract<typeof r, { ok: true }>;
}

test("最初の入札は開始価格でトップになり、価格は開始価格のまま", async () => {
  const id = await mk(3600_000);
  assert.equal(minimumBid(getListing(id)!), 1000);
  assert.equal((await placeBid(id, u1, 900)).ok, false);
  const r = ok(await placeBid(id, u1, 3000));
  assert.equal(r.outcome, "leading");
  assert.equal(r.price, 1000);
  const l = getListing(id)!;
  assert.equal(l.current_price, 1000);
  assert.equal(bidStatus(id, u1).my_max, 3000);
  assert.equal(bidStatus(id).leader_id, u1);
});

test("上限に届かない入札は即負けし、価格は自分の上限まで上がる", async () => {
  const id = await mk(3600_000);
  ok(await placeBid(id, u1, 3000)); // 価格1000
  const r = ok(await placeBid(id, u2, 1500));
  assert.equal(r.outcome, "lost");
  assert.equal(r.price, 1600); // 1500 + 100（相手の上限3000以内）
  assert.equal(getListing(id)!.current_price, 1600);
  assert.equal(bidStatus(id).leader_id, u1);
  const lost = myLostBids(u2);
  assert.equal(lost[0].listing_id, id);
  assert.equal(lost[0].amount, 1500);
  // 履歴には相手の自動入札として残る
  const bids = getBids(id);
  assert.equal(bids[0].user_id, u1);
  assert.equal(bids[0].is_auto, 1);
  // 競り負けた側には高値更新通知は飛ばない（最初からトップでない）
  const notes = getDb().prepare("SELECT * FROM notifications WHERE user_id = ? AND listing_id = ?").all(u2, id);
  assert.equal(notes.length, 0);
});

test("上限と同額なら先に入れた方が勝ち、価格はその額になる", async () => {
  const id = await mk(3600_000);
  ok(await placeBid(id, u1, 3000));
  const r = ok(await placeBid(id, u2, 3000));
  assert.equal(r.outcome, "lost");
  assert.equal(r.price, 3000);
  assert.equal(bidStatus(id).leader_id, u1);
});

test("相手の上限を超えるとトップが入れ替わり、価格は相手の上限＋単位。相手に通知", async () => {
  const id = await mk(3600_000);
  ok(await placeBid(id, u1, 3000));
  const r = ok(await placeBid(id, u2, 5000));
  assert.equal(r.outcome, "leading");
  assert.equal(r.price, 3100);
  assert.equal(bidStatus(id).leader_id, u2);
  const notes = getDb().prepare("SELECT * FROM notifications WHERE user_id = ? AND type = 'outbid' AND listing_id = ?").all(u1, id);
  assert.equal(notes.length, 1);
  // 上限ぴったり超え：価格は自分の上限が天井
  const r2 = ok(await placeBid(id, u3, 5050));
  assert.equal(r2.price, 5050);
});

test("トップが自分の上限を引き上げても価格は動かない", async () => {
  const id = await mk(3600_000);
  ok(await placeBid(id, u1, 2000));
  assert.equal((await placeBid(id, u1, 2000)).ok, false);
  const r = ok(await placeBid(id, u1, 4000));
  assert.equal(r.outcome, "raised");
  assert.equal(getListing(id)!.current_price, 1000);
  assert.equal(bidStatus(id, u1).my_max, 4000);
});

test("終了間際の入札で延長。サドンデスは延長が回数ごとに短くなる", async () => {
  const id = await mk(3600_000, { sudden: true });
  ok(await placeBid(id, u1, 1000));
  assert.equal(extensionSeconds(getListing(id)!), 300);
  const before = setEndsIn(id, 30_000);
  const r = ok(await placeBid(id, u2, 1100));
  assert.equal(r.extended, true);
  let l = getListing(id)!;
  assert.ok(l.ends_at > before);
  assert.equal(l.extended_count, 1);
  assert.equal(extensionSeconds(l), 240);
  setEndsIn(id, 30_000);
  ok(await placeBid(id, u1, 1300));
  l = getListing(id)!;
  assert.equal(l.extended_count, 2);
  assert.equal(extensionSeconds(l), 180);
  // 最短は60秒
  getDb().prepare("UPDATE listings SET extended_count = 50 WHERE id = ?").run(id);
  assert.equal(extensionSeconds(getListing(id)!), 60);
});

test("延長で終了時刻が短くなることはない", async () => {
  const id = await mk(3600_000, { sudden: true });
  getDb().prepare("UPDATE listings SET extended_count = 10 WHERE id = ?").run(id); // 延長幅は最短60秒
  const before = setEndsIn(id, 200_000); // 残り200秒 < 300秒の窓
  ok(await placeBid(id, u1, 1000));
  assert.equal(getListing(id)!.ends_at, before);
});

test("終了処理：トップ上限の人が落札し通知。終了後の入札は拒否", async () => {
  const id = await mk(3600_000);
  ok(await placeBid(id, u1, 1000));
  ok(await placeBid(id, u2, 1200));
  setEndsIn(id, -1000);
  assert.equal((await placeBid(id, u1, 1300)).ok, false);
  await finalizeEnded();
  const l = getListing(id)!;
  assert.equal(l.status, "ended");
  assert.equal(l.winner_id, u2);
  assert.equal(l.current_price, 1100);
  const won = getDb().prepare("SELECT * FROM notifications WHERE user_id = ? AND type = 'won' AND listing_id = ?").all(u2, id);
  assert.equal(won.length, 1);
});

test("入札なしで終了すると落札者なし", async () => {
  const id = await mk(100);
  await new Promise((r) => setTimeout(r, 200));
  await finalizeEnded();
  const l = getListing(id)!;
  assert.equal(l.status, "ended");
  assert.equal(l.winner_id, null);
});

test("フォローと新規出品通知", async () => {
  assert.equal(toggleFollow(u3, sellerId), true);
  assert.equal(isFollowing(u3, sellerId), true);
  await mk(3600_000);
  const notes = getDb().prepare("SELECT * FROM notifications WHERE user_id = ? AND type = 'new_listing'").all(u3);
  assert.equal(notes.length, 1);
  assert.equal(toggleFollow(u3, sellerId), false);
});

test("myBids は自分の上限とトップかどうかを返す", async () => {
  const id = await mk(3600_000);
  ok(await placeBid(id, u1, 1000));
  ok(await placeBid(id, u2, 1500));
  const mine = myBids(u1).find((l) => l.id === id)!;
  assert.equal(mine.my_max, 1000);
  assert.equal(mine.leader_id, u2);
  assert.equal(myBids(u2).find((l) => l.id === id)!.my_max, 1500);
});

test("お気に入りの登録・解除・一覧", async () => {
  const id = await mk(3600_000);
  assert.equal(toggleFavorite(u1, id), true);
  assert.ok(myFavorites(u1).some((l) => l.id === id));
  assert.equal(toggleFavorite(u1, id), false);
  assert.ok(!myFavorites(u1).some((l) => l.id === id));
});

test("キーワード検索はタイトル・品種・出品者名に効く", async () => {
  await mk(3600_000, { title: "特別 黒ラメ黄幹之 若魚" });
  const r1 = listListings({ tab: "open", q: "黒ラメ黄" });
  assert.ok(r1.items.every((l) => l.title.includes("黒ラメ黄")));
  assert.ok(r1.total >= 1);
  const r2 = listListings({ tab: "open", q: "テスト出品者" });
  assert.ok(r2.total >= 1);
  const r3 = listListings({ tab: "open", q: "存在しない品種XYZ" });
  assert.equal(r3.total, 0);
});
