"use server";

import { redirect } from "next/navigation";
import { isValidEmail, normalizeEmail, requestOtp, verifyOtp } from "@/lib/auth";

function safeNext(v: unknown): string {
  const s = String(v ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/auctions";
}

export async function requestCodeAction(formData: FormData): Promise<void> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const next = safeNext(formData.get("next"));
  if (!isValidEmail(email)) redirect(`/login?error=${encodeURIComponent("メールアドレスの形式が正しくありません。")}&next=${encodeURIComponent(next)}`);
  const { debugCode } = await requestOtp(email);
  const p = new URLSearchParams({ step: "code", email, next });
  if (debugCode) p.set("debug", debugCode);
  redirect(`/login?${p.toString()}`);
}

export async function verifyCodeAction(formData: FormData): Promise<void> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const code = String(formData.get("code") ?? "");
  const next = safeNext(formData.get("next"));
  const r = await verifyOtp(email, code);
  if (!r.ok) {
    const p = new URLSearchParams({ step: "code", email, next, error: r.error });
    redirect(`/login?${p.toString()}`);
  }
  redirect(next);
}
