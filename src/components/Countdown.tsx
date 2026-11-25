"use client";

import { useEffect, useState } from "react";
import { remaining } from "@/lib/format";
import { useRouter } from "next/navigation";

/** 残り時間を毎秒更新し、終了したらページを再読み込みして結果を反映する */
export default function Countdown({ endsAt, fallback }: { endsAt: string; fallback: string }) {
  const [text, setText] = useState(fallback);
  const router = useRouter();
  useEffect(() => {
    let done = false;
    const id = setInterval(() => {
      const left = new Date(endsAt).getTime() - Date.now();
      if (left <= 0) {
        if (!done) {
          done = true;
          setText("終了");
          setTimeout(() => router.refresh(), 1500);
        }
        return;
      }
      if (left < 3600_000) {
        const m = Math.floor(left / 60000);
        const s = Math.floor((left % 60000) / 1000);
        setText(`残り${m}分${String(s).padStart(2, "0")}秒`);
      } else {
        setText(remaining(endsAt));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt, router]);
  const urgent = new Date(endsAt).getTime() - Date.now() < 10 * 60_000;
  return <span className={`font-bold ${urgent ? "text-danger" : "text-ok"}`}>{text}</span>;
}
