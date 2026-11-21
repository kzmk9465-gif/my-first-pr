"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { grantSellerPin, sellerContext } from "@/lib/seller-gate";
import { deleteTemplate, saveTemplate, updateOrderStatus, updateSellerSettings, verifySellerPin, type Order } from "@/lib/sellers";
import { createListing, cancelListing, getListing } from "@/lib/auctions";
import { saveImage } from "@/lib/uploads";
import { fromLocalInputValue } from "@/lib/format";
import { siteConfig } from "@/lib/config";

async function requireSeller(next = "/sell") {
  const ctx = await sellerContext();
  if (!ctx.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!ctx.seller) redirect("/sell");
  if (!ctx.pinOk) redirect(`/sell/pin?next=${encodeURIComponent(next)}`);
  return { user: ctx.user, seller: ctx.seller };
}
const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max);

export async function pinAction(formData: FormData): Promise<void> {
  const ctx = await sellerContext();
  const next = String(formData.get("next") ?? "/sell/dashboard");
  if (!ctx.user) redirect("/login?next=/sell");
  if (!ctx.seller) redirect("/sell");
  if (!verifySellerPin(ctx.seller, str(formData, "pin", 20))) redirect(`/sell/pin?next=${encodeURIComponent(next)}&error=${encodeURIComponent("PINコードが違います。")}`);
  await grantSellerPin(ctx.seller.id);
  redirect(next.startsWith("/") ? next : "/sell/dashboard");
}

export async function sellerCreateListingAction(formData: FormData): Promise<void> {
  const { user, seller } = await requireSeller("/sell/new");
  const fail = (msg: string): never => redirect(`/sell/new?error=${encodeURIComponent(msg)}`);
  const title = str(formData, "title", 120);
  const startPrice = Number(str(formData, "start_price"));
  const buyout = Number(str(formData, "buyout_price")) || null;
  const endsRaw = str(formData, "ends_at");
  const startsRaw = str(formData, "starts_at");
  if (!title) fail("タイトルは必須です。");
  if (!Number.isInteger(startPrice) || startPrice <= 0) fail("開始価格は1円以上の整数で入力してください。");
  if (buyout !== null && buyout <= startPrice) fail("即決価格は開始価格より高くしてください。");
  if (!endsRaw) fail("終了日時は必須です。");
  const starts_at = startsRaw ? fromLocalInputValue(startsRaw) : new Date().toISOString();
  const ends_at = fromLocalInputValue(endsRaw);
  if (ends_at <= starts_at) fail("終了日時は開始日時より後にしてください。");

  // 画像アップロード（最大6枚）
  const images: string[] = [];
  for (const f of formData.getAll("images")) {
    if (!(f instanceof File) || f.size === 0) continue;
    if (images.length >= 6) break;
    const r = await saveImage(f);
    if (!r.ok) return fail(r.error);
    images.push(r.url);
  }
  const imageUrl = str(formData, "image_url", 500);
  if (imageUrl) images.unshift(imageUrl);

  const video = str(formData, "video_url", 300);
  if (video && !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(video)) fail("動画は YouTube のURLのみ対応です。");

  const method = str(formData, "shipping_method") === "cool" ? "cool" : "normal";
  const shippingFee = method === "cool" ? seller.shipping_cool : seller.shipping_normal;

  // テンプレート保存
  const description = str(formData, "description", 3000);
  if (formData.get("save_template") === "on" && description) {
    const r = saveTemplate(seller.id, str(formData, "template_name", 40) || title.slice(0, 30), description);
    if (!r.ok) fail(r.error);
  }

  const id = await createListing({
    seller_id: seller.id,
    title,
    subtitle: str(formData, "subtitle", 120),
    variety: str(formData, "variety", 60),
    breeder: str(formData, "breeder", 60) || seller.name,
    certificate: ["original", "sales", "bloodline"].includes(str(formData, "certificate")) ? str(formData, "certificate") : "",
    quantity: str(formData, "quantity", 40),
    description,
    image_url: images[0] ?? "",
    images,
    video_url: video,
    start_price: startPrice,
    buyout_price: buyout,
    bid_increment: Number(str(formData, "bid_increment")) || siteConfig.defaultBidIncrement,
    starts_at,
    ends_at,
    featured: false,
    hot: false,
    sudden_death: formData.get("sudden_death") === "on",
    shipping_method: method,
    shipping_fee: shippingFee,
    fee_rate: seller.fee_rate,
    created_by: user.id,
    needs_review: user.role !== "admin",
  });
  revalidatePath("/sell/dashboard");
  const again = formData.get("continue") === "on";
  redirect(again ? `/sell/new?saved=${id}` : `/sell/dashboard?saved=${id}`);
}

export async function sellerCancelListingAction(formData: FormData): Promise<void> {
  const { seller } = await requireSeller("/sell/dashboard");
  const id = Number(formData.get("id"));
  const l = getListing(id);
  if (l && l.seller_id === seller.id && (l.status === "review" || (l.status !== "ended" && l.bid_count === 0))) {
    cancelListing(id);
    if (l.status === "review") (await import("@/lib/db")).getDb().prepare("UPDATE listings SET status = 'cancelled' WHERE id = ? AND status = 'review'").run(id);
  }
  revalidatePath("/sell/dashboard");
  redirect("/sell/dashboard");
}

export async function orderStatusAction(formData: FormData): Promise<void> {
  const { seller } = await requireSeller("/sell/dashboard");
  const listingId = Number(formData.get("listing_id"));
  const status = str(formData, "status") as Order["status"];
  const r = await updateOrderStatus(seller.id, listingId, status, {
    carrier: str(formData, "carrier", 40) || undefined,
    tracking_no: str(formData, "tracking_no", 60) || undefined,
    note: str(formData, "note", 300) || undefined,
  });
  revalidatePath("/sell/dashboard");
  revalidatePath("/mypage");
  redirect(r.ok ? "/sell/dashboard?updated=1" : `/sell/dashboard?error=${encodeURIComponent(r.error)}`);
}

export async function sellerSettingsAction(formData: FormData): Promise<void> {
  const { seller } = await requireSeller("/sell/settings");
  updateSellerSettings(seller.id, {
    shipping_normal: Math.max(0, Number(str(formData, "shipping_normal")) || 0),
    shipping_cool: Math.max(0, Number(str(formData, "shipping_cool")) || 0),
    payment_info: str(formData, "payment_info", 500),
    description: str(formData, "description", 500),
  });
  revalidatePath("/sell/settings");
  redirect("/sell/settings?saved=1");
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  const { seller } = await requireSeller("/sell/new");
  deleteTemplate(seller.id, Number(formData.get("id")));
  revalidatePath("/sell/new");
  redirect("/sell/new");
}
