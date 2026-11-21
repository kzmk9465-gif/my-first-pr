import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "banshu-auth-"));
process.env.DATABASE_PATH = path.join(dir, "test.sqlite");
process.env.REQUIRE_APPROVAL = "true";

// next/headers に依存しない members モジュールを使う
const { canBid, needsRegistration } = await import("../src/lib/members.ts");

test("承認制：承認済みか管理者のみ入札可。停止中は不可", () => {
  assert.equal(canBid({ status: "pending", role: "user" }), false);
  assert.equal(canBid({ status: "approved", role: "user" }), true);
  assert.equal(canBid({ status: "blocked", role: "user" }), false);
  assert.equal(canBid({ status: "pending", role: "admin" }), true);
  assert.equal(canBid({ status: "blocked", role: "admin" }), false);
});

test("氏名か住所が無ければ登録フォームへ", () => {
  assert.equal(needsRegistration({ name: null, shipping_address: null }), true);
  assert.equal(needsRegistration({ name: "太郎", shipping_address: null }), true);
  assert.equal(needsRegistration({ name: "太郎", shipping_address: "姫路市" }), false);
});
