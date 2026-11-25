"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, canBid } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { points } from "@/lib/gacha";
import { draw, redeem, requestShipping, type DrawResult } from "@/lib/oripa";

export type DrawResponse =
  | { ok: true; results: DrawResult[]; balance: number; remaining: number }
  | { ok: false; error: string };

export async function drawOripaAction(packageId: string, count: number): Promise<DrawResponse> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ログインしてください。" };
  if (!canBid(user)) return { ok: false, error: "会員承認後にくじを引けます。" };
  const r = await draw(user.id, packageId, count);
  if (r.ok) revalidatePath("/oripa");
  return r;
}

export async function redeemOripaAction(drawIds: number[]): Promise<{ ok: true; gained: number; balance: number } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ログインしてください。" };
  const r = redeem(user.id, drawIds.filter((n) => Number.isInteger(n)));
  if (r.ok) revalidatePath("/oripa");
  return r;
}

export async function shipOripaAction(drawIds: number[]): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ログインしてください。" };
  const r = await requestShipping(user.id, drawIds.filter((n) => Number.isInteger(n)));
  if (r.ok) revalidatePath("/oripa");
  return r;
}

/** プロトタイプ用のテストチャージ（実決済は未接続）。ポイントを加算する。 */
export async function chargeAction(amount: number): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ログインしてください。" };
  const amt = [3000, 5000, 10000, 30000].includes(amount) ? amount : 5000;
  getDb().prepare("INSERT INTO point_logs (user_id, delta, reason) VALUES (?, ?, 'charge_mock')").run(user.id, amt);
  revalidatePath("/oripa");
  revalidatePath("/", "layout");
  return { ok: true, balance: points(user.id) };
}
