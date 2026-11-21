"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { placeBid, toggleFollow } from "@/lib/auctions";

export async function bidAction(formData: FormData): Promise<void> {
  const listingId = Number(formData.get("listing_id"));
  const amount = Number(String(formData.get("amount") ?? "").replace(/[,，\s円]/g, ""));
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/auctions/${listingId}`);
  const r = await placeBid(listingId, user.id, amount);
  revalidatePath(`/auctions/${listingId}`);
  revalidatePath("/auctions");
  if (!r.ok) redirect(`/auctions/${listingId}?error=${encodeURIComponent(r.error)}`);
  redirect(`/auctions/${listingId}?bid=${r.amount}${r.extended ? "&extended=1" : ""}`);
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
