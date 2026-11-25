"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { applySecondaryCertificate } from "@/lib/certificates";

export async function applySecondaryAction(formData: FormData): Promise<void> {
  const parent = String(formData.get("parent") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/certificates/${parent}`);
  const r = applySecondaryCertificate(parent, user.id, { title: String(formData.get("title") ?? ""), note: String(formData.get("note") ?? "") });
  if (!r.ok) redirect(`/certificates/${parent}?error=${encodeURIComponent(r.error)}`);
  redirect(`/certificates/${parent}?applied=${r.cert.code}`);
}
