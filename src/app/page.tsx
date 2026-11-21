import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";
import Gate from "@/components/Gate";

export const metadata: Metadata = { title: "入場" };

export default function GatePage() {
  return <Gate name={siteConfig.name} target="/auctions" />;
}
