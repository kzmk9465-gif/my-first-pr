import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "banshu-oripa-"));
process.env.DATABASE_PATH = path.join(dir, "test.sqlite");

const { getDb } = await import("../src/lib/db.ts");
const { seedOripa } = await import("../src/lib/seed-demo.ts");
const { addPrize, createOrder, createPackage, draw, getOrder, getPackage, isAdult, isSellable, listPrizes, markOrderPaid, remaining, requestShipping, shippingFor, SHIPPING_YEN, FREE_SHIPPING_COUNT } = await import("../src/lib/oripa.ts");

let adult: number; let minor: number; let pkgId: number;
const ADULT = { id: 0, birthdate: "1990-01-01" };
before(() => {
  const db = getDb();
  adult = Number(db.prepare("INSERT INTO users (email, status, birthdate) VALUES ('adult@example.com','approved','1990-01-01')").run().lastInsertRowid);
  minor = Number(db.prepare("INSERT INTO users (email, status, birthdate) VALUES ('minor@example.com','approved',?)").run(new Date(Date.now() - 10 * 365 * 86400_000).toISOString().slice(0, 10)).lastInsertRowid);
  ADULT.id = adult;
  seedOripa(db);
  pkgId = getPackage("gokujo-rame")!.id;
});

test("18歳判定", () => {
  assert.equal(isAdult("1990-01-01"), true);
  assert.equal(isAdult(null), false);
  assert.equal(isAdult("2020-01-01"), false);
  const today = new Date("2026-11-25T00:00:00Z");
  assert.equal(isAdult("2008-11-25", today), true);
  assert.equal(isAdult("2008-11-26", today), false);
});

test("デモのくじは賞の本数の合計＝総口数で販売可", () => {
  const pkg = getPackage("gokujo-rame")!;
  assert.equal(isSellable(pkg), true);
  assert.equal(listPrizes(pkg.id).reduce((a, p) => a + p.count_total, 0), pkg.total);
});

test("18歳未満は口を買えない", () => {
  const r = createOrder({ id: minor, birthdate: new Date(Date.now() - 10 * 365 * 86400_000).toISOString().slice(0, 10) }, "gokujo-rame", 1, "mock");
  assert.equal(r.ok, false);
});

test("入金前は引けない。入金確認は1回だけ有効。入金後に引けて口数が減る", async () => {
  const before = remaining(pkgId);
  const o = createOrder(ADULT, "gokujo-rame", 2, "mock");
  assert.ok(o.ok);
  if (!o.ok) return;
  assert.equal(o.amount, 10000 + SHIPPING_YEN); // 2口なので送料が乗る
  assert.equal(remaining(pkgId), before - 2); // 入金待ちでも口は予約される
  const d0 = await draw(adult, o.token, 1);
  assert.equal(d0.ok, false);
  assert.equal(markOrderPaid(o.token), true);
  assert.equal(markOrderPaid(o.token), false); // 二重の入金確認は無効
  const d1 = await draw(adult, o.token, 1);
  assert.ok(d1.ok);
  if (!d1.ok) return;
  assert.equal(d1.results.length, 1);
  assert.equal(d1.left, 1);
  const d2 = await draw(adult, o.token, 2); // 残り1口なのに2口は不可
  assert.equal(d2.ok, false);
  const d3 = await draw(adult, o.token, 1);
  assert.ok(d3.ok);
  assert.equal(getOrder(o.token)!.drawn, 2);
  const d4 = await draw(adult, o.token, 1); // 使い切った注文では引けない
  assert.equal(d4.ok, false);
});

test("非復元抽出：rng=0 は残っている最上位の賞を引き、本数が尽きると次の賞に移る", async () => {
  const id = createPackage({ slug: "box-test", name: "テスト箱", price_yen: 1000, total: 3 });
  addPrize(id, { rarity: "S", name: "S1", count: 1 });
  addPrize(id, { rarity: "C", name: "C1", count: 2 });
  const o = createOrder(ADULT, "box-test", 3, "mock");
  assert.ok(o.ok);
  if (!o.ok) return;
  markOrderPaid(o.token);
  const r = await draw(adult, o.token, 3, () => 0);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.results.map((x) => x.rarity), ["S", "C", "C"]);
  const left = listPrizes(id);
  assert.equal(left.find((p) => p.name === "S1")!.count_left, 0);
  assert.equal(left.find((p) => p.name === "C1")!.count_left, 0);
  assert.equal(remaining(id), 0);
  // 完売後は買えない
  const again = createOrder(ADULT, "box-test", 1, "mock");
  assert.equal(again.ok, false);
});

test("賞の本数が総口数と合わないくじは売れない", () => {
  const id = createPackage({ slug: "half-box", name: "半端な箱", price_yen: 1000, total: 5 });
  addPrize(id, { rarity: "C", name: "C", count: 3 });
  assert.equal(isSellable(getPackage("half-box")!), false);
  const o = createOrder(ADULT, "half-box", 1, "mock");
  assert.equal(o.ok, false);
});

test("当選品は発送依頼できる（還元はできない）", async () => {
  const o = createOrder(ADULT, "ryusei", 1, "mock");
  assert.ok(o.ok);
  if (!o.ok) return;
  markOrderPaid(o.token);
  const r = await draw(adult, o.token, 1);
  assert.ok(r.ok);
  if (!r.ok) return;
  const w = r.results[0];
  // 流星くじのC賞は「選べる賞」なので、その場合は選択肢を1つ添える
  const ship = await requestShipping(adult, [w.id], w.options.length > 0 ? { [w.id]: w.options[0] } : {});
  assert.ok(ship.ok);
  const row = getDb().prepare("SELECT status FROM oripa_draws WHERE id = ?").get(r.results[0].id) as { status: string };
  assert.equal(row.status, "ship_requested");
  // 旧「還元」の入口が無いこと（モジュールに redeem が存在しない）
  const mod = await import("../src/lib/oripa.ts");
  assert.equal("redeem" in mod, false);
});

test("送料: 少口数の注文は送料を合算、所定口数以上は無料。注文に送料が記録される", () => {
  assert.equal(shippingFor(1), SHIPPING_YEN);
  assert.equal(shippingFor(FREE_SHIPPING_COUNT), 0);
  const small = createOrder(ADULT, "ryusei", 1, "mock");
  assert.ok(small.ok);
  if (small.ok) {
    const o = getOrder(small.token)!;
    assert.equal(o.shipping_yen, SHIPPING_YEN);
    assert.equal(o.amount_yen, 3000 + SHIPPING_YEN);
  }
  const big = createOrder(ADULT, "ryusei", FREE_SHIPPING_COUNT, "mock");
  assert.ok(big.ok);
  if (big.ok) {
    const o = getOrder(big.token)!;
    assert.equal(o.shipping_yen, 0);
    assert.equal(o.amount_yen, 3000 * FREE_SHIPPING_COUNT);
  }
});

test("選べる賞：発送依頼のときに選択肢から1つ選ぶ。未選択・選択肢外は不可、選んだものが記録される", async () => {
  const id = createPackage({ slug: "choice-box", name: "選べる箱", price_yen: 1000, total: 1 });
  addPrize(id, { rarity: "C", name: "選べるC賞", count: 1, options: "ラメ系 1ペア／めだかのエサ 100g" });
  assert.equal(listPrizes(id)[0].options, "ラメ系 1ペア／めだかのエサ 100g");
  const o = createOrder(ADULT, "choice-box", 1, "mock");
  assert.ok(o.ok);
  if (!o.ok) return;
  markOrderPaid(o.token);
  const r = await draw(adult, o.token, 1);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.results[0].options, ["ラメ系 1ペア", "めだかのエサ 100g"]);
  const did = r.results[0].id;
  const none = await requestShipping(adult, [did]);
  assert.equal(none.ok, false);
  const bad = await requestShipping(adult, [did], { [did]: "現金" });
  assert.equal(bad.ok, false);
  assert.equal((getDb().prepare("SELECT status FROM oripa_draws WHERE id = ?").get(did) as { status: string }).status, "won");
  const good = await requestShipping(adult, [did], { [did]: "めだかのエサ 100g" });
  assert.ok(good.ok);
  const row = getDb().prepare("SELECT status, choice FROM oripa_draws WHERE id = ?").get(did) as { status: string; choice: string };
  assert.equal(row.status, "ship_requested");
  assert.equal(row.choice, "めだかのエサ 100g");
});
