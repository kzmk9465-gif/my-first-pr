import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "banshu-p4-"));
process.env.DATABASE_PATH = path.join(dir, "test.sqlite");

const { getDb } = await import("../src/lib/db.ts");
const { createListing, placeBid, liveState, ticker, listComments, postComment, setCommentsEnabled, isHeated, heatedIds, finalizeEnded } = await import("../src/lib/auctions.ts");
const { createNews, activeNews, setNewsActive, hotResults, headline } = await import("../src/lib/news.ts");

let sellerId: number; let u1: number; let u2: number; let u3: number;
before(() => {
  const db = getDb();
  sellerId = Number(db.prepare("INSERT INTO sellers (name, slug) VALUES ('S', 's')").run().lastInsertRowid);
  u1 = Number(db.prepare("INSERT INTO users (email, status, name) VALUES ('p4a@example.com', 'approved', '甲')").run().lastInsertRowid);
  u2 = Number(db.prepare("INSERT INTO users (email, status, name) VALUES ('p4b@example.com', 'approved', '乙')").run().lastInsertRowid);
  u3 = Number(db.prepare("INSERT INTO users (email, status, name) VALUES ('p4c@example.com', 'approved', '丙')").run().lastInsertRowid);
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));
const base = () => ({
  seller_id: sellerId, title: "S) 幹之 1ペア", variety: "", breeder: "", certificate: "", quantity: "", description: "", image_url: "",
  start_price: 1000, bid_increment: 100, starts_at: new Date(Date.now() - 1000).toISOString(), ends_at: new Date(Date.now() + 3600_000).toISOString(),
  featured: false, hot: false, sudden_death: false,
});

test("入札すると弾幕が自動投稿され、ライブ状態に反映。上限引き上げでは投稿しない", async () => {
  const id = await createListing(base());
  await placeBid(id, u1, 3000);
  await placeBid(id, u2, 1500); // 即負け
  await placeBid(id, u1, 5000); // 引き上げ
  const cs = listComments(id);
  assert.equal(cs.length, 2);
  assert.match(cs[0].body, /甲さんキター!! 1,000 円/);
  assert.match(cs[1].body, /乙さん 挑むも届かず/);
  assert.equal(cs[0].kind, "system");
  const s = liveState(id)!;
  assert.equal(s.current_price, 1600);
  assert.equal(s.bid_count, 2);
  assert.equal(s.leader_label, "甲");
  assert.equal(s.recent[0].is_auto, 1);
  assert.equal(s.duel, null);
  // after で差分取得
  assert.equal(listComments(id, cs[0].id).length, 1);
});

test("一騎打ちは直近の入札が2人で交互のときだけ", async () => {
  const id = await createListing(base());
  await placeBid(id, u1, 1000);
  await placeBid(id, u2, 1100);
  await placeBid(id, u1, 1200);
  await placeBid(id, u2, 1300);
  const s = liveState(id)!;
  assert.ok(s.duel);
  assert.equal(s.duel!.a_count + s.duel!.b_count, 4);
  await placeBid(id, u3, 1400);
  assert.equal(liveState(id)!.duel, null);
  assert.equal(isHeated(id), true); // 1時間に3件以上
  assert.ok(heatedIds().has(id));
  const t = ticker(3);
  assert.equal(t[0].listing_id, id);
  assert.equal(t[0].label, "丙");
});

test("コメント投稿：空文字拒否、60字で切る、10秒の連投制限、出品ごとのON/OFF", () => {
  const db = getDb();
  const id = Number(db.prepare("INSERT INTO listings (seller_id, title, start_price, current_price, starts_at, ends_at, status) VALUES (?, 'c', 1000, 1000, '2020-01-01', '2999-01-01', 'open')").run(sellerId).lastInsertRowid);
  assert.equal(postComment(id, u1, "   ").ok, false);
  const r = postComment(id, u1, "あ".repeat(80));
  assert.equal(r.ok, true);
  assert.equal(listComments(id)[0].body.length, 60);
  assert.equal(postComment(id, u1, "連投").ok, false);
  assert.equal(postComment(id, u2, "別人はOK").ok, true);
  setCommentsEnabled(id, false);
  assert.equal(postComment(id, u3, "無効").ok, false);
  assert.equal(postComment(id, null, "運営", "admin").ok, false);
  setCommentsEnabled(id, true);
  assert.equal(postComment(id, null, "運営", "admin").ok, true);
  assert.equal(listComments(id).at(-1)!.label, "運営");
});

test("瓦版・告知：種類別の有効一覧、期限切れ、非表示", () => {
  const n1 = createNews({ kind: "news", title: "お知らせ1", body: "", image_url: "" });
  createNews({ kind: "alert", title: "告知", body: "本文", image_url: "" });
  const expired = createNews({ kind: "broadcast", title: "期限切れ", body: "", image_url: "", expires_in_minutes: 1 });
  getDb().prepare("UPDATE news SET expires_at = '2000-01-01' WHERE id = ?").run(expired);
  assert.equal(activeNews("news").length, 1);
  assert.equal(activeNews("alert")[0].title, "告知");
  assert.equal(activeNews("broadcast").length, 0);
  setNewsActive(n1, false);
  assert.equal(activeNews("news").length, 0);
  assert.equal(activeNews().length, 1);
});

test("瓦版の自動記事：終了した激戦の品を入札数順に", async () => {
  const id = await createListing(base());
  await placeBid(id, u1, 1000);
  await placeBid(id, u2, 2500);
  getDb().prepare("UPDATE listings SET ends_at = ? WHERE id = ?").run(new Date(Date.now() - 1000).toISOString(), id);
  await finalizeEnded();
  const r = hotResults(3);
  assert.equal(r[0].id, id);
  assert.equal(r[0].bidders, 2);
  const h = headline(r[0], 0);
  assert.ok(h.includes("幹之"));
  assert.notEqual(headline(r[0], 0), headline(r[0], 60_000));
});
