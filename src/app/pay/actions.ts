"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPayment, markPaymentPaid } from "@/lib/payments";

export async function completeMockPaymentAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const user = await getCurrentUser();
  const p = getPayment(token);
  if (!user || !p || user.id !== p.buyer_id) redirect("/mypage?tab=won");
  if (p!.provider !== "mock") redirect(`/pay/return?token=${token}`);
  await markPaymentPaid(token, "mock");
  redirect(`/pay/return?token=${token}`);
}
