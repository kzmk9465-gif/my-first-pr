import { cookies } from "next/headers";
import { createHmac } from "node:crypto";
import { getCurrentUser, type User } from "./auth";
import { getSellerForUser, type SellerAccount } from "./sellers";

const COOKIE = "banshu_seller_pin";
const HOURS = 12;

function sign(sellerId: number, exp: number): string {
  const salt = process.env.OTP_SALT ?? "banshu-dev-salt";
  return createHmac("sha256", salt).update(`${sellerId}:${exp}`).digest("hex");
}

/** PIN 認証済みの出品者セッションを張る（12時間） */
export async function grantSellerPin(sellerId: number): Promise<void> {
  const exp = Date.now() + HOURS * 3600_000;
  const jar = await cookies();
  jar.set(COOKIE, `${sellerId}.${exp}.${sign(sellerId, exp)}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: new Date(exp), path: "/",
  });
}

export async function hasSellerPin(sellerId: number): Promise<boolean> {
  const jar = await cookies();
  const v = jar.get(COOKIE)?.value;
  if (!v) return false;
  const [id, exp, sig] = v.split(".");
  if (Number(id) !== sellerId || Number(exp) < Date.now()) return false;
  return sig === sign(sellerId, Number(exp));
}

export type SellerContext = { user: User; seller: SellerAccount; pinOk: boolean };

/** 出品者ページ共通：ログイン＋出品者アカウント＋PINの状態を返す */
export async function sellerContext(): Promise<{ user: User | null; seller: SellerAccount | null; pinOk: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { user: null, seller: null, pinOk: false };
  const seller = getSellerForUser(user.id);
  if (!seller) return { user, seller: null, pinOk: false };
  return { user, seller, pinOk: await hasSellerPin(seller.id) };
}
