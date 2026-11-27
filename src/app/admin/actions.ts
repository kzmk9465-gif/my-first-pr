"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { cancelListing, createListing, createSeller, publishListing } from "@/lib/auctions";
import { feePlanRate, randomPin, updateSellerAccount } from "@/lib/sellers";
import { getDb } from "@/lib/db";
import { createNews, setNewsActive } from "@/lib/news";
import { setCommentsEnabled } from "@/lib/auctions";
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
  const buyout = Number(str(formData, "buyout_price")) || null;
  const increment = Number(str(formData, "bid_increment")) || siteConfig.defaultBidIncrement;
  const fail = (msg: string) => redirect(`/admin/listings/new?error=${encodeURIComponent(msg)}`);
  if (!str(formData, "title")) fail("タイトルは必須です。");
  if (!Number(str(formData, "seller_id"))) fail("出品者を選択してください。");
  if (!Number.isInteger(startPrice) || startPrice <= 0) fail("開始価格は1円以上の整数で入力してください。");
  if (buyout !== null && buyout <= startPrice) fail("即決価格は開始価格より高くしてください。");
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
    buyout_price: buyout,
    subtitle: str(formData, "subtitle", 120),
    video_url: str(formData, "video_url", 300),
    min_rank: Math.max(0, Number(str(formData, "min_rank")) || 0),
    passphrase: str(formData, "passphrase", 60),
    mystery: formData.get("mystery") === "on",
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

export async function publishListingAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  await publishListing(id);
  revalidatePath("/auctions");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function rejectListingAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  getDb().prepare("UPDATE listings SET status = 'cancelled' WHERE id = ? AND status = 'review'").run(id);
  revalidatePath("/admin");
  redirect("/admin");
}

/** 出品者アカウント設定：会員との紐づけ・手数料プラン・PIN発行 */
export async function sellerAccountAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const sellerId = Number(formData.get("seller_id"));
  const email = str(formData, "user_email", 100).toLowerCase();
  let userId: number | null = null;
  if (email) {
    const u = getDb().prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | undefined;
    if (!u) redirect(`/admin/sellers?error=${encodeURIComponent("そのメールアドレスの会員が見つかりません。先に会員登録（ログイン）してもらってください。")}`);
    userId = u.id;
  }
  const plan = str(formData, "fee_plan");
  const feeRate = plan === "custom" ? Math.min(100, Math.max(0, Number(str(formData, "fee_rate")) || 0)) : feePlanRate(plan);
  const wantPin = formData.get("issue_pin") === "on";
  const pin = wantPin ? randomPin() : undefined;
  updateSellerAccount(sellerId, { user_id: userId, fee_rate: feeRate, pin, accepts_online: formData.get("accepts_online") === "on" });
  revalidatePath("/admin/sellers");
  const p = new URLSearchParams({ saved: "1" });
  if (pin) p.set("pin", pin);
  p.set("seller", String(sellerId));
  redirect(`/admin/sellers?${p.toString()}`);
}

export async function reviewCertificateAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { reviewSecondaryCertificate } = await import("@/lib/certificates");
  await reviewSecondaryCertificate(Number(formData.get("id")), String(formData.get("decision")) === "approve");
  revalidatePath("/admin/certificates");
  redirect("/admin/certificates");
}

export async function createNewsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const kind = (["news", "alert", "broadcast"] as const).find((k) => k === str(formData, "kind")) ?? "news";
  const title = str(formData, "title", 120);
  if (!title) redirect(`/admin/news?error=${encodeURIComponent("見出しは必須です。")}`);
  createNews({ kind, title, body: str(formData, "body", 2000), image_url: str(formData, "image_url", 500), expires_in_minutes: Number(str(formData, "expires")) || undefined });
  revalidatePath("/", "layout");
  redirect("/admin/news?saved=1");
}

export async function toggleNewsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  setNewsActive(Number(formData.get("id")), formData.get("active") === "1");
  revalidatePath("/", "layout");
  redirect("/admin/news");
}

export async function toggleCommentsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  setCommentsEnabled(Number(formData.get("id")), formData.get("enabled") === "1");
  revalidatePath("/admin");
  redirect("/admin");
}

/* ---------- 第5段階 ---------- */

export async function varietyStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { setVarietyStatus } = await import("@/lib/zukan");
  const status = String(formData.get("status"));
  if (status === "approved" || status === "rejected") setVarietyStatus(Number(formData.get("id")), status);
  revalidatePath("/zukan");
  revalidatePath("/admin/zukan");
  redirect("/admin/zukan");
}

export async function createContestAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { createContest } = await import("@/lib/contests");
  const title = str(formData, "title", 100);
  if (!title) redirect(`/admin/contests?error=${encodeURIComponent("タイトルは必須です。")}`);
  createContest(title, str(formData, "description", 2000));
  revalidatePath("/contests");
  redirect("/admin/contests?saved=1");
}

export async function contestStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { setContestStatus } = await import("@/lib/contests");
  const status = String(formData.get("status"));
  if (status === "entry" || status === "voting" || status === "closed") setContestStatus(Number(formData.get("id")), status);
  revalidatePath("/contests");
  redirect("/admin/contests");
}

export async function addPrizeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { addPrize } = await import("@/lib/gacha");
  const name = str(formData, "name", 60);
  if (!name) redirect(`/admin/gacha?error=${encodeURIComponent("景品名は必須です。")}`);
  const stock = str(formData, "stock") ? Number(str(formData, "stock")) : null;
  addPrize(name, Number(str(formData, "weight")) || 1, stock);
  redirect("/admin/gacha?saved=1");
}

export async function prizeActiveAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { setPrizeActive } = await import("@/lib/gacha");
  setPrizeActive(Number(formData.get("id")), formData.get("active") === "1");
  redirect("/admin/gacha");
}

export async function fulfillPrizeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { markFulfilled } = await import("@/lib/gacha");
  markFulfilled(Number(formData.get("id")));
  redirect("/admin/gacha");
}

// ---- 播州くじ（確定版）----

export async function createOripaPackageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { createPackage, getPackage } = await import("@/lib/oripa");
  const name = str(formData, "name", 60);
  const slug = str(formData, "slug", 40).toLowerCase();
  const price = Number(str(formData, "price_yen"));
  const total = Number(str(formData, "total"));
  if (!name || !/^[a-z0-9-]{2,40}$/.test(slug)) redirect(`/admin/oripa?error=${encodeURIComponent("名前とURL名（英小文字・数字・-）は必須です。")}`);
  if (!Number.isInteger(price) || price < 100 || !Number.isInteger(total) || total < 1) redirect(`/admin/oripa?error=${encodeURIComponent("価格と総口数を正しく入力してください。")}`);
  if (getPackage(slug)) redirect(`/admin/oripa?error=${encodeURIComponent("そのURL名は使われています。")}`);
  createPackage({ slug, name, subtitle: str(formData, "subtitle", 120), price_yen: price, total });
  revalidatePath("/oripa");
  redirect("/admin/oripa?saved=1");
}

export async function addOripaPrizeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { addPrize, getPackageById } = await import("@/lib/oripa");
  const pkgId = Number(formData.get("package_id"));
  const name = str(formData, "name", 80);
  const rarity = str(formData, "rarity", 1);
  const kind = str(formData, "kind", 10);
  const count = Number(str(formData, "count"));
  if (!getPackageById(pkgId) || !name || !["S", "A", "B", "C"].includes(rarity) || !["medaka", "goods", "card"].includes(kind) || !Number.isInteger(count) || count < 1) {
    redirect(`/admin/oripa?error=${encodeURIComponent("賞品名・賞・種類・本数を正しく入力してください。")}`);
  }
  // 実物写真: ファイルが添付されていれば保存(EXIF除去・WebP化)。無ければ画像URL欄を使う
  let imageUrl: string | null = str(formData, "image_url", 300) || null;
  const f = formData.get("image");
  if (f instanceof File && f.size > 0) {
    const { saveImage } = await import("@/lib/uploads");
    const r = await saveImage(f);
    if (!r.ok) redirect(`/admin/oripa?error=${encodeURIComponent(r.error)}`);
    imageUrl = r.url;
  }
  addPrize(pkgId, { rarity: rarity as "S" | "A" | "B" | "C", name, kind: kind as "medaka" | "goods" | "card", ref_price: Number(str(formData, "ref_price")) || 0, ref_note: str(formData, "ref_note", 120), image_url: imageUrl, count, options: str(formData, "options", 300) });
  revalidatePath("/oripa");
  redirect("/admin/oripa?saved=1");
}

export async function deleteOripaPrizeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { deletePrize } = await import("@/lib/oripa");
  if (!deletePrize(Number(formData.get("id")))) redirect(`/admin/oripa?error=${encodeURIComponent("当選が出ている賞は削除できません。")}`);
  revalidatePath("/oripa");
  redirect("/admin/oripa?saved=1");
}

export async function oripaPackageStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { setPackageStatus } = await import("@/lib/oripa");
  const status = String(formData.get("status"));
  if (status === "open" || status === "closed") setPackageStatus(Number(formData.get("id")), status);
  revalidatePath("/oripa");
  redirect("/admin/oripa");
}

/** 銀行振込の入金確認（または取消）。pending の行だけが対象なので二重確認にならない */
export async function confirmOripaOrderAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { cancelOrder, getOrder, markOrderPaid } = await import("@/lib/oripa");
  const { notifyUser } = await import("@/lib/notify");
  const token = str(formData, "token", 60);
  const order = getOrder(token);
  if (!order) redirect(`/admin/oripa?error=${encodeURIComponent("注文が見つかりません。")}`);
  if (formData.get("cancel") === "1") {
    cancelOrder(token);
  } else if (markOrderPaid(token)) {
    const u = getDb().prepare("SELECT id, email, line_user_id FROM users WHERE id = ?").get(order!.user_id) as { id: number; email: string; line_user_id: string | null };
    await notifyUser(u, "system", `✅ 播州くじのご入金を確認しました（注文番号 ${token.slice(-6).toUpperCase()}・${order!.count}口）。播州くじのページから引けます。`).catch(() => {});
  }
  revalidatePath("/oripa");
  redirect("/admin/oripa?saved=1");
}

export async function shipOripaDrawAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { markDrawShipped } = await import("@/lib/oripa");
  markDrawShipped(Number(formData.get("id")));
  redirect("/admin/oripa?saved=1");
}

export async function handleReportAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { handleReport } = await import("@/lib/reports");
  handleReport(Number(formData.get("id")));
  if (formData.get("cancel") === "1") cancelListing(Number(formData.get("listing_id")));
  revalidatePath("/admin/reports");
  redirect("/admin/reports");
}
