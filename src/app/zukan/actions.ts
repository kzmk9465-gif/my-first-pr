"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canBid, getCurrentUser } from "@/lib/auth";
import { registerVariety } from "@/lib/zukan";

export async function registerVarietyAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/zukan/new");
  if (!canBid(user)) redirect(`/zukan/new?error=${encodeURIComponent("承認済み会員のみ品種を登録できます。")}`);
  const f = (k: string) => String(formData.get(k) ?? "");
  const r = registerVariety({
    name: f("name"),
    user_id: user.id,
    breeder_name: f("breeder_name") || user.shop_name || user.name || "",
    prefecture: f("prefecture"),
    instagram: f("instagram") || user.instagram || "",
    description: f("description"),
    image_url: f("image_url"),
    traits: formData.getAll("traits").map(String),
    auto_approve: user.role === "admin",
  });
  if (!r.ok) redirect(`/zukan/new?error=${encodeURIComponent(r.error)}`);
  revalidatePath("/zukan");
  redirect(`/zukan/new?saved=${r.id}`);
}
