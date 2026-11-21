"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canBid, getCurrentUser, needsRegistration } from "@/lib/auth";
import { placeBid, toggleFavorite, toggleFollow } from "@/lib/auctions";

function parseAmount(v: FormDataEntryValue | null): number {
  return Number(String(v ?? "").replace(/[,，\s円]/g, ""));
}

/** 入札フォーム → 確認画面へ */
export async function confirmBidAction(formData: FormData): Promise<void> {
  const listingId = Number(formData.get("listing_id"));
  const amount = parseAmount(formData.get("amount"));
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/auctions/${listingId}`);
  if (needsRegistration(user)) redirect(`/register?next=/auctions/${listingId}`);
  if (!canBid(user)) redirect(`/auctions/${listingId}?error=${encodeURIComponent("会員承認後に入札できます。")}`);
  if (!Number.isInteger(amount) || amount <= 0) redirect(`/auctions/${listingId}?error=${encodeURIComponent("金額を整数で入力してください。")}`);
  redirect(`/auctions/${listingId}/confirm?amount=${amount}`);
}

/** 確認画面 → 入札確定 */
export async function bidAction(formData: FormData): Promise<void> {
  const listingId = Number(formData.get("listing_id"));
  const amount = parseAmount(formData.get("amount"));
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/auctions/${listingId}`);
  if (needsRegistration(user)) redirect(`/register?next=/auctions/${listingId}`);
  if (!canBid(user)) redirect(`/auctions/${listingId}?error=${encodeURIComponent("会員承認後に入札できます。")}`);
  if (formData.get("agree") !== "on") redirect(`/auctions/${listingId}/confirm?amount=${amount}&error=${encodeURIComponent("確認事項にチェックを入れてください。")}`);
  const r = await placeBid(listingId, user.id, amount);
  revalidatePath(`/auctions/${listingId}`);
  revalidatePath("/auctions");
  if (!r.ok) redirect(`/auctions/${listingId}?error=${encodeURIComponent(r.error)}`);
  const p = new URLSearchParams({ bid: String(r.max), outcome: r.outcome, price: String(r.price) });
  if (r.extended) p.set("extended", "1");
  redirect(`/auctions/${listingId}?${p.toString()}`);
}

export async function followAction(formData: FormData): Promise<void> {
  const sellerId = Number(formData.get("seller_id"));
  const back = String(formData.get("back") ?? "/auctions");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);
  toggleFollow(user.id, sellerId);
  revalidatePath(back);
  redirect(back);
}

export async function favoriteAction(formData: FormData): Promise<void> {
  const listingId = Number(formData.get("listing_id"));
  const back = String(formData.get("back") ?? `/auctions/${listingId}`);
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);
  toggleFavorite(user.id, listingId);
  revalidatePath(back);
  revalidatePath("/mypage");
  redirect(back);
}
