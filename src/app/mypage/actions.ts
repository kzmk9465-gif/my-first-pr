"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser, logout, setLineUserId, updateProfile } from "@/lib/auth";
import { markNotificationsRead } from "@/lib/auctions";

export async function updateProfileAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mypage");
  updateProfile(user.id, {
    name: String(formData.get("name") ?? "").trim().slice(0, 40),
    shipping_name: String(formData.get("shipping_name") ?? "").trim().slice(0, 60),
    shipping_postal: String(formData.get("shipping_postal") ?? "").trim().slice(0, 10),
    shipping_address: String(formData.get("shipping_address") ?? "").trim().slice(0, 200),
    shipping_phone: String(formData.get("shipping_phone") ?? "").trim().slice(0, 20),
  });
  revalidatePath("/mypage");
  redirect("/mypage?saved=1");
}

export async function linkLineAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mypage");
  const id = String(formData.get("line_user_id") ?? "").trim();
  setLineUserId(user.id, id || null);
  revalidatePath("/mypage");
  redirect("/mypage?saved=1");
}

export async function markReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) markNotificationsRead(user.id);
  revalidatePath("/mypage");
}

export async function completeOrderAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mypage");
  const { completeOrderByBuyer } = await import("@/lib/sellers");
  completeOrderByBuyer(user.id, Number(formData.get("listing_id")));
  revalidatePath("/mypage");
  redirect("/mypage?received=1");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/auctions");
}

export async function loginBonusAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mypage");
  const { claimLoginBonus } = await import("@/lib/gacha");
  const got = claimLoginBonus(user.id);
  revalidatePath("/mypage");
  redirect(got ? "/mypage?bonus=1" : "/mypage?bonus=0");
}

export async function gachaAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mypage");
  const { spin } = await import("@/lib/gacha");
  const r = await spin(user.id);
  revalidatePath("/mypage");
  if (!r.ok) redirect(`/mypage?gacha_error=${encodeURIComponent(r.error)}`);
  redirect(`/mypage?gacha=${encodeURIComponent(r.prize)}&won=${r.won ? 1 : 0}`);
}

export async function startPaymentAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mypage");
  const { startCheckout } = await import("@/lib/payments");
  const r = await startCheckout(Number(formData.get("listing_id")), user.id);
  if (!r.ok) redirect(`/mypage?pay_error=${encodeURIComponent(r.error)}#orders`);
  redirect(r.url);
}
