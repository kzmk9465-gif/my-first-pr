"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { cancelListing, createListing, createSeller } from "@/lib/auctions";
import { fromLocalInputValue } from "@/lib/format";
import { siteConfig } from "@/lib/config";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/auctions");
  return user;
}

function str(fd: FormData, k: string, max = 500) {
  return String(fd.get(k) ?? "").trim().slice(0, max);
}

export async function createListingAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const startsRaw = str(formData, "starts_at");
  const endsRaw = str(formData, "ends_at");
  const startPrice = Number(str(formData, "start_price"));
  const increment = Number(str(formData, "bid_increment")) || siteConfig.defaultBidIncrement;
  const fail = (msg: string) => redirect(`/admin/listings/new?error=${encodeURIComponent(msg)}`);
  if (!str(formData, "title")) fail("タイトルは必須です。");
  if (!Number(str(formData, "seller_id"))) fail("出品者を選択してください。");
  if (!Number.isInteger(startPrice) || startPrice <= 0) fail("開始価格は1円以上の整数で入力してください。");
  if (!endsRaw) fail("終了日時は必須です。");
  const starts_at = startsRaw ? fromLocalInputValue(startsRaw) : new Date().toISOString();
  const ends_at = fromLocalInputValue(endsRaw);
  if (ends_at <= starts_at) fail("終了日時は開始日時より後にしてください。");
  const id = await createListing({
    seller_id: Number(str(formData, "seller_id")),
    title: str(formData, "title", 120),
    variety: str(formData, "variety", 60),
    breeder: str(formData, "breeder", 60),
    certificate: ["original", "sales", "bloodline"].includes(str(formData, "certificate")) ? str(formData, "certificate") : "",
    quantity: str(formData, "quantity", 40),
    description: str(formData, "description", 3000),
    image_url: str(formData, "image_url", 500),
    start_price: startPrice,
    bid_increment: increment,
    starts_at,
    ends_at,
    featured: formData.get("featured") === "on",
    hot: formData.get("hot") === "on",
    sudden_death: formData.get("sudden_death") === "on",
  });
  revalidatePath("/auctions");
  redirect(`/auctions/${id}`);
}

export async function cancelListingAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  cancelListing(id);
  revalidatePath("/auctions");
  revalidatePath(`/auctions/${id}`);
  redirect("/admin");
}

export async function createSellerAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = str(formData, "name", 60);
  const slug = str(formData, "slug", 60).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!name || !slug) redirect(`/admin/sellers?error=${encodeURIComponent("名前とスラッグは必須です（スラッグは英数字とハイフン）。")}`);
  try {
    createSeller(name, slug, str(formData, "description", 500));
  } catch {
    redirect(`/admin/sellers?error=${encodeURIComponent("そのスラッグは既に使われています。")}`);
  }
  redirect("/admin/sellers?saved=1");
}

export async function setMemberStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status"));
  const f = String(formData.get("f") ?? "pending");
  if (!["pending", "approved", "blocked"].includes(status)) redirect("/admin/members");
  const { setUserStatus } = await import("@/lib/auth");
  const { getUserById } = await import("@/lib/auctions");
  const { notifyUser } = await import("@/lib/notify");
  setUserStatus(id, status as "pending" | "approved" | "blocked");
  const u = getUserById(id);
  if (u && status === "approved") {
    await notifyUser({ id: u.id, email: u.email, line_user_id: (u as { line_user_id?: string | null }).line_user_id ?? null }, "system", "会員登録が承認されました。入札をお楽しみください。");
  }
  revalidatePath("/admin/members");
  redirect(`/admin/members?f=${f}`);
}
