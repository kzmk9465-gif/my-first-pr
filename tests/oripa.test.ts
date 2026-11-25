import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "banshu-oripa-"));
process.env.DATABASE_PATH = path.join(dir, "test.sqlite");

const { getDb } = await import("../src/lib/db.ts");
const { points } = await import("../src/lib/gacha.ts");
const { draw, redeem, requestShipping, remaining, getPackage } = await import("../src/lib/oripa.ts");

let rich: number; let poor: number;
before(() => {
  const db = getDb();
  rich = Number(db.prepare("INSERT INTO users (email, status) VALUES ('rich@example.com','approved')").run().lastInsertRowid);
  poor = Number(db.prepare("INSERT INTO users (email, status) VALUES ('poor@example.com','approved')").run().lastInsertRowid);
  db.prepare("INSERT INTO point_logs (user_id, delta, reason) VALUES (?, 20000, 'charge_mock')").run(rich);
});

test("ポイント不足では引けない", async () => {
  const r = await draw(poor, "gokujo-rame", 1);
  assert.equal(r.ok, false);
});

test("1回引くとポイントが消費され、当選が記録され、残り口数が減る", async () => {
  const before = points(rich);
  const beforeRemain = remaining("gokujo-rame");
  // rng=0 → 先頭の景品（S賞）を引く
  const r = await draw(rich, "gokujo-rame", 1, () => 0);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.results.length, 1);
  assert.equal(r.results[0].rarity, "S");
  assert.equal(points(rich), before - getPackage("gokujo-rame")!.pricePt);
  assert.equal(r.balance, before - 5000);
  assert.equal(remaining("gokujo-rame"), beforeRemain - 1);
});

test("当選をポイント還元すると残高が増え、状態がredeemedになる", async () => {
  const r = await draw(rich, "gokujo-rame", 1, () => 0); // S賞 redeemPt 60000
  assert.ok(r.ok);
  if (!r.ok) return;
  const id = r.results[0].id;
  const before = points(rich);
  const red = redeem(rich, [id]);
  assert.ok(red.ok);
  if (!red.ok) return;
  assert.equal(red.gained, r.results[0].redeemPt);
  assert.equal(red.balance, before + r.results[0].redeemPt);
  const row = getDb().prepare("SELECT status FROM oripa_draws WHERE id = ?").get(id) as { status: string };
  assert.equal(row.status, "redeemed");
  // 二重還元はできない
  const again = redeem(rich, [id]);
  assert.ok(again.ok && again.gained === 0);
});

test("発送依頼で状態がship_requestedになる", async () => {
  const r = await draw(rich, "gokujo-rame", 1, () => 0);
  assert.ok(r.ok);
  if (!r.ok) return;
  const id = r.results[0].id;
  const ship = await requestShipping(rich, [id]);
  assert.ok(ship.ok);
  const row = getDb().prepare("SELECT status FROM oripa_draws WHERE id = ?").get(id) as { status: string };
  assert.equal(row.status, "ship_requested");
});

test("残り口数を超える連数は引けない", async () => {
  const db = getDb();
  const u = Number(db.prepare("INSERT INTO users (email, status) VALUES ('ryusei@example.com','approved')").run().lastInsertRowid);
  db.prepare("INSERT INTO point_logs (user_id, delta, reason) VALUES (?, 1000000, 'charge_mock')").run(u);
  // ryusei を残り5口まで埋める（total 150）
  const pkg = getPackage("ryusei")!;
  const ins = db.prepare("INSERT INTO oripa_draws (user_id, package_id, rarity, prize_name, ref_price, redeem_pt) VALUES (?, 'ryusei','C','x',0,0)");
  for (let i = 0; i < pkg.total - 5; i++) ins.run(u);
  assert.equal(remaining("ryusei"), 5);
  const r = await draw(u, "ryusei", 10);
  assert.equal(r.ok, false); // 残り5口に10連は不可
  const r1 = await draw(u, "ryusei", 1);
  assert.ok(r1.ok);
});
