"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, canBid } from "@/lib/auth";
import { createOrder, draw, getOrder, markOrderPaid, oripaProvider, requestShipping, type DrawResult } from "@/lib/oripa";

export type DrawResponse =
  | { ok: true; results: DrawResult[]; left: number; remaining: number }
  | { ok: false; error: string };

/** 口を買う（注文を作って決済へ）。入金確認後に引ける。 */
export async function buyOripaAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const slug = String(formData.get("slug") ?? "");
  const count = Number(formData.get("count") ?? 1);
  if (!user) redirect(`/login?next=${encodeURIComponent("/oripa")}`);
  if (!canBid(user)) redirect(`/oripa?error=${encodeURIComponent("会員承認後にくじを購入できます。")}`);
  if (!user.birthdate) redirect(`/register?next=${encodeURIComponent("/oripa")}&error=${encodeURIComponent("くじのご購入には生年月日の登録が必要です。")}`);
  const r = createOrder({ id: user.id, birthdate: user.birthdate }, slug, count, oripaProvider());
  if (!r.ok) redirect(`/oripa?error=${encodeURIComponent(r.error)}`);
  revalidatePath("/oripa");
  redirect(`/oripa/order/${r.token}`);
}

/** お試し環境のテスト決済（決済事業者の画面の代わり）。本番では使えない。 */
export async function mockPayOripaAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const token = String(formData.get("token") ?? "");
  const order = getOrder(token);
  if (!user || !order || order.user_id !== user.id) redirect("/oripa");
  if (order.provider !== "mock" || oripaProvider() !== "mock") redirect(`/oripa/order/${token}`);
  markOrderPaid(token);
  revalidatePath("/oripa");
  redirect(`/oripa?paid=${token}`);
}

export async function drawOripaAction(orderToken: string, count: number): Promise<DrawResponse> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ログインしてください。" };
  if (!canBid(user)) return { ok: false, error: "会員承認後にくじを引けます。" };
  const r = await draw(user.id, orderToken, count);
  if (r.ok) revalidatePath("/oripa");
  return r;
}

export async function shipOripaAction(drawIds: number[]): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ログインしてください。" };
  const r = await requestShipping(user.id, drawIds.filter((n) => Number.isInteger(n)));
  if (r.ok) { revalidatePath("/oripa"); revalidatePath("/mypage"); }
  return r;
}

/** マイページ等のフォームから、未依頼の当選品をまとめて発送依頼する */
export async function shipAllOripaAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/oripa");
  const ids = String(formData.get("ids") ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  await requestShipping(user.id, ids);
  revalidatePath("/oripa");
  revalidatePath("/mypage");
  redirect("/oripa?shipped=1");
}
