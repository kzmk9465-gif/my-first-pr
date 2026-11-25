import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "banshu-p5-"));
process.env.DATABASE_PATH = path.join(dir, "test.sqlite");

const { getDb } = await import("../src/lib/db.ts");
const { registerVariety, searchVarieties, setVarietyStatus, traitsOf } = await import("../src/lib/zukan.ts");
const { createContest, setContestStatus, enter, vote, entries, myVote } = await import("../src/lib/contests.ts");
const { claimLoginBonus, points, spin, addPrize, GACHA_COST, listPrizes, bonusClaimedToday } = await import("../src/lib/gacha.ts");
const { reportListing, openReports, handleReport } = await import("../src/lib/reports.ts");
const { makeState, parseState } = await import("../src/lib/line-login.ts");

let u1: number; let u2: number; let sellerId: number; let listingId: number;
before(() => {
  const db = getDb();
  u1 = Number(db.prepare("INSERT INTO users (email, status, name) VALUES ('p5a@example.com', 'approved', '甲')").run().lastInsertRowid);
  u2 = Number(db.prepare("INSERT INTO users (email, status, name) VALUES ('p5b@example.com', 'approved', '乙')").run().lastInsertRowid);
  sellerId = Number(db.prepare("INSERT INTO sellers (name, slug) VALUES ('S', 's')").run().lastInsertRowid);
  listingId = Number(db.prepare("INSERT INTO listings (seller_id, title, start_price, current_price, starts_at, ends_at, status) VALUES (?, 'x', 1000, 1000, '2020-01-01', '2999-01-01', 'open')").run(sellerId).lastInsertRowid);
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

test("図鑑：登録は承認後に掲載、形質の複合検索とキーワード検索", () => {
  assert.equal(registerVariety({ name: "  ", user_id: u1, breeder_name: "", prefecture: "", instagram: "", description: "", image_url: "", traits: [] }).ok, false);
  const r = registerVariety({ name: "播州三色ラメ", user_id: u1, breeder_name: "甲めだか", prefecture: "兵庫県", instagram: "@kou", description: "三色にラメ", image_url: "", traits: ["三色", "ラメ", "存在しない形質"] });
  assert.equal(r.ok, true);
  const id = (r as { id: number }).id;
  assert.equal(searchVarieties({}).length, 0);
  setVarietyStatus(id, "approved");
  assert.equal(searchVarieties({}).length, 1);
  assert.deepEqual(traitsOf(searchVarieties({})[0]), ["三色", "ラメ"]);
  assert.equal(searchVarieties({ traits: ["三色", "ラメ"] }).length, 1);
  assert.equal(searchVarieties({ traits: ["三色", "ダルマ"] }).length, 0);
  assert.equal(searchVarieties({ keyword: "甲めだか" }).length, 1);
  assert.equal(searchVarieties({ keyword: "zzz" }).length, 0);
  assert.equal(searchVarieties({})[0].instagram, "kou");
});

test("品評会：受付中のみエントリー（3点まで）、投票は1人1票で自分には不可、票は変えられる", () => {
  const c = createContest("第1回", "");
  assert.equal(vote(c, 1, u1).ok, false);
  for (let i = 0; i < 3; i++) assert.equal(enter(c, u1, { title: `甲の${i}`, image_url: "", description: "" }).ok, true);
  assert.equal(enter(c, u1, { title: "4点目", image_url: "", description: "" }).ok, false);
  assert.equal(enter(c, u2, { title: "乙の1", image_url: "", description: "" }).ok, true);
  setContestStatus(c, "voting");
  assert.equal(enter(c, u2, { title: "遅い", image_url: "", description: "" }).ok, false);
  const es = entries(c);
  const mineA = es.find((e) => e.title === "甲の0")!, otsu = es.find((e) => e.title === "乙の1")!;
  assert.equal(vote(c, mineA.id, u1).ok, false);
  assert.equal(vote(c, otsu.id, u1).ok, true);
  assert.equal(vote(c, mineA.id, u2).ok, true);
  assert.equal(myVote(c, u2), mineA.id);
  const other = es.find((e) => e.title === "甲の1")!;
  assert.equal(vote(c, other.id, u2).ok, true); // 票を変更
  assert.equal(myVote(c, u2), other.id);
  assert.equal(entries(c).find((e) => e.id === mineA.id)!.votes, 0);
  assert.equal(entries(c).find((e) => e.id === other.id)!.votes, 1);
  setContestStatus(c, "closed");
  assert.equal(vote(c, otsu.id, u2).ok, false);
  assert.equal(entries(c)[0].votes, 1);
});

test("ガチャ：ログインボーナスは1日1回、10ポイントで1回、重み付き抽選と在庫", async () => {
  assert.equal(claimLoginBonus(u1), true);
  assert.equal(claimLoginBonus(u1), false);
  assert.equal(bonusClaimedToday(u1), true);
  assert.equal(points(u1), 1);
  assert.equal((await spin(u1)).ok, false);
  getDb().prepare("INSERT INTO point_logs (user_id, delta, reason) VALUES (?, 19, 'test')").run(u1);
  assert.equal(points(u1), 20);
  addPrize("餌サンプル", 30, 1);
  // rng=0 → はずれ側、rng=0.99 → 景品側
  const miss = await spin(u1, () => 0);
  assert.equal(miss.ok && miss.won, false);
  assert.equal(points(u1), 20 - GACHA_COST);
  const hit = await spin(u1, () => 0.99);
  assert.equal(hit.ok && hit.won && hit.prize, "餌サンプル");
  assert.equal(listPrizes()[0].stock, 0);
  assert.equal(listPrizes(true).length, 0);
  assert.ok(getDb().prepare("SELECT 1 FROM notifications WHERE user_id = ? AND message LIKE '%餌サンプル%'").get(u1));
});

test("通報：理由必須、未対応の重複は不可、対応後は再通報できる", () => {
  assert.equal(reportListing(listingId, u1, " ").ok, false);
  assert.equal(reportListing(listingId, u1, "画像が他店のもの").ok, true);
  assert.equal(reportListing(listingId, u1, "二回目").ok, false);
  assert.equal(openReports().length, 1);
  handleReport(openReports()[0].id);
  assert.equal(openReports().length, 0);
  assert.equal(reportListing(listingId, u1, "再発").ok, true);
});

test("LINEログインの state は署名付きで、改ざんと期限切れを拒否", () => {
  const st = makeState({ next: "/mypage", link: 7 });
  const p = parseState(st)!;
  assert.equal(p.next, "/mypage");
  assert.equal(p.link, 7);
  assert.equal(parseState(st + "x"), null);
  assert.equal(parseState(st, -1), null);
  assert.equal(parseState(makeState({ next: "https://evil.example" }))!.next, "/auctions");
});
