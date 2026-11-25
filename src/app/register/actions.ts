"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser, registerProfile } from "@/lib/auth";

function safeNext(v: unknown): string {
  const s = String(v ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/auctions";
}

export async function registerAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const next = safeNext(formData.get("next"));
  if (!user) redirect(`/login?next=${encodeURIComponent(`/register?next=${next}`)}`);
  const f = (k: string, max = 100) => String(formData.get(k) ?? "").trim().slice(0, max);
  const birthdate = f("birthdate", 10);
  const data = {
    name: f("name", 40),
    shop_name: f("shop_name", 60),
    instagram: f("instagram", 60).replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, ""),
    shipping_name: f("shipping_name", 60) || f("name", 40),
    shipping_postal: f("shipping_postal", 10),
    shipping_address: f("shipping_address", 200),
    shipping_phone: f("shipping_phone", 20),
    birthdate,
  };
  const back = (msg: string) => redirect(`/register?next=${encodeURIComponent(next)}&error=${encodeURIComponent(msg)}`);
  if (!data.name || !data.shipping_postal || !data.shipping_address || !data.shipping_phone) back("氏名・郵便番号・住所・電話番号は必須です。");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate) || Number.isNaN(new Date(birthdate).getTime()) || new Date(birthdate).getTime() > Date.now()) back("生年月日を正しく入力してください。");
  if (formData.get("agree") !== "on") back("利用規約への同意が必要です。");
  registerProfile(user.id, data);
  revalidatePath("/mypage");
  redirect(user.status === "approved" ? next : `/register/done?next=${encodeURIComponent(next)}`);
}
