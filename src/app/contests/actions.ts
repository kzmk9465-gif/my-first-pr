"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canBid, getCurrentUser } from "@/lib/auth";
import { enter, vote } from "@/lib/contests";

export async function enterContestAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("contest_id"));
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/contests/${id}`);
  if (!canBid(user)) redirect(`/contests/${id}?error=${encodeURIComponent("承認済み会員のみエントリーできます。")}`);
  const r = enter(id, user.id, { title: String(formData.get("title") ?? ""), image_url: String(formData.get("image_url") ?? ""), description: String(formData.get("description") ?? "") });
  revalidatePath(`/contests/${id}`);
  redirect(r.ok ? `/contests/${id}?entered=1` : `/contests/${id}?error=${encodeURIComponent(r.error)}`);
}

export async function voteAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("contest_id"));
  const entryId = Number(formData.get("entry_id"));
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/contests/${id}`);
  if (!canBid(user)) redirect(`/contests/${id}?error=${encodeURIComponent("承認済み会員のみ投票できます。")}`);
  const r = vote(id, entryId, user.id);
  revalidatePath(`/contests/${id}`);
  redirect(r.ok ? `/contests/${id}?voted=1` : `/contests/${id}?error=${encodeURIComponent(r.error)}`);
}
