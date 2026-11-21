"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canBid, getCurrentUser, needsRegistration } from "@/lib/auth";
import { getListing, isUnlocked, placeBid, toggleFavorite, toggleFollow, unlockListing } from "@/lib/auctions";
import { userRank } from "@/lib/ranks";
import type { User } from "@/lib/auth";

/** 闇市（ランク）と限定（合言葉）の制限を確認。問題があればエラー文を返す。 */
function accessError(listingId: number, user: User): string | null {
  const l = getListing(listingId);
  if (!l) return "出品が見つかりません。";
  if (user.role === "admin") return null;
  if (l.min_rank > 0 && userRank(user.id).rank.level < l.min_rank) return "この出品は会員ランクが足りないため入札できません。";
  if (l.passphrase_hash && !isUnlocked(user.id, listingId)) return "この出品は合言葉を入力すると入札できます。";
  return null;
}

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
  const ae = accessError(listingId, user);
  if (ae) redirect(`/auctions/${listingId}?error=${encodeURIComponent(ae)}`);
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
  const ae = accessError(listingId, user);
  if (ae) redirect(`/auctions/${listingId}?error=${encodeURIComponent(ae)}`);
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

/** 即決の確定 */
export async function buyNowAction(formData: FormData): Promise<void> {
  const listingId = Number(formData.get("listing_id"));
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/auctions/${listingId}`);
  if (needsRegistration(user)) redirect(`/register?next=/auctions/${listingId}`);
  if (!canBid(user)) redirect(`/auctions/${listingId}?error=${encodeURIComponent("会員承認後に即決できます。")}`);
  if (formData.get("agree") !== "on") redirect(`/auctions/${listingId}/buyout?error=${encodeURIComponent("確認事項にチェックを入れてください。")}`);
  const ae = accessError(listingId, user);
  if (ae) redirect(`/auctions/${listingId}?error=${encodeURIComponent(ae)}`);
  const { buyNow } = await import("@/lib/auctions");
  const r = await buyNow(listingId, user.id);
  revalidatePath(`/auctions/${listingId}`);
  revalidatePath("/auctions");
  revalidatePath("/mypage");
  if (!r.ok) redirect(`/auctions/${listingId}?error=${encodeURIComponent(r.error)}`);
  redirect(`/auctions/${listingId}?bought=${r.price}`);
}

/** 限定オークションの合言葉 */
export async function unlockAction(formData: FormData): Promise<void> {
  const listingId = Number(formData.get("listing_id"));
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/auctions/${listingId}`);
  const ok = unlockListing(user.id, listingId, String(formData.get("passphrase") ?? ""));
  revalidatePath(`/auctions/${listingId}`);
  redirect(ok ? `/auctions/${listingId}?unlocked=1` : `/auctions/${listingId}?error=${encodeURIComponent("合言葉が違います。")}`);
}

/** 落札販売証明書の発行 */
export async function issueCertificateAction(formData: FormData): Promise<void> {
  const listingId = Number(formData.get("listing_id"));
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/auctions/${listingId}`);
  const { issueSaleCertificate } = await import("@/lib/certificates");
  const r = issueSaleCertificate(listingId, user.id);
  if (!r.ok) redirect(`/auctions/${listingId}?error=${encodeURIComponent(r.error)}`);
  revalidatePath("/mypage");
  redirect(`/certificates/${r.cert.code}`);
}
