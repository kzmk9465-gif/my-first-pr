"use client";

import { useEffect, useState } from "react";

/** でか文字放送：管理者の重要メッセージを画面中央に大きく表示（閉じると当該IDは再表示しない） */
export default function Broadcast({ id, text }: { id: number; text: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { setShow(localStorage.getItem(`banshu_bc_${id}`) !== "1"); } catch { setShow(true); }
  }, [id]);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={() => { setShow(false); try { localStorage.setItem(`banshu_bc_${id}`, "1"); } catch { /* ignore */ } }}>
      <div className="text-center">
        <div className="text-xs tracking-[0.5em] text-muted mb-3">運営より</div>
        <div className="text-3xl sm:text-5xl font-black text-accent-2 leading-tight drop-shadow-[0_0_30px_rgba(0,240,255,.6)] whitespace-pre-wrap">{text}</div>
        <div className="mt-6 text-xs text-muted">タップで閉じる</div>
      </div>
    </div>
  );
}
