"use client";

import { useState, useTransition } from "react";
import { chargeAction } from "@/app/oripa/actions";

const AMOUNTS = [3000, 5000, 10000, 30000];
const pt = (n: number) => `${n.toLocaleString("ja-JP")} pt`;

/** ヘッダー右の所持ポイント表示＋テストチャージ。 */
export default function ChargePill({ balance: balance0 }: { balance: number }) {
  const [balance, setBalance] = useState(balance0);
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();

  const charge = (amount: number) => start(async () => {
    const r = await chargeAction(amount);
    if (r.ok) setBalance(r.balance);
    setOpen(false);
  });

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-[#101726] pl-2.5 pr-1 py-0.5">
        <span className="tnum text-accent-2 font-bold text-[13px] leading-none">{pt(balance)}</span>
        <button onClick={() => setOpen((o) => !o)} aria-label="ポイントをチャージ"
          className="h-6 px-2 rounded-full text-[11px] font-bold leading-none"
          style={{ color: "#05121f", background: "linear-gradient(180deg,var(--accent-2),var(--accent))" }}>＋チャージ</button>
      </div>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-48 rounded-xl border border-white/10 bg-[#182234] p-2 shadow-[0_18px_40px_-20px_rgba(0,0,0,.9)]">
            <p className="text-[10px] text-muted px-1 pb-1">テストチャージ（決済は未接続）</p>
            <div className="grid grid-cols-2 gap-1.5">
              {AMOUNTS.map((a) => (
                <button key={a} disabled={busy} onClick={() => charge(a)}
                  className="rounded-lg border border-white/10 bg-[#101726] py-1.5 text-xs font-bold tnum hover:border-accent/40 disabled:opacity-50">
                  ＋{a.toLocaleString("ja-JP")}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
