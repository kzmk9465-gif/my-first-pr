"use client";

import { useState } from "react";
import { confirmBidAction } from "@/app/auctions/[id]/actions";

type Props = {
  listingId: number;
  base: number;       // 入札の下限（min）
  increment: number;  // 入札単位
  currentPrice: number;
  iAmTop: boolean;
  myMax: number;
};

function yen(n: number) { return `${n.toLocaleString("ja-JP")} 円`; }

/** クイック入札チップ＋上限額入力＋「入札内容を確認する」。確認画面(confirmBidAction)へ送る。 */
export default function BidBox({ listingId, base, increment, currentPrice, iAmTop, myMax }: Props) {
  const floor = iAmTop ? myMax + 1 : base;
  const [amount, setAmount] = useState<number>(iAmTop ? myMax + increment : base);
  const chips = [increment, increment * 5, increment * 10];
  const quick = (add: number) => setAmount(Math.max(floor, (iAmTop ? myMax : currentPrice) + add));

  return (
    <form action={confirmBidAction} className="space-y-2.5">
      <input type="hidden" name="listing_id" value={listingId} />
      <div>
        <div className="text-xs text-muted mb-1">クイック入札（現在価格に上乗せ）</div>
        <div className="grid grid-cols-3 gap-2">
          {chips.map((c) => (
            <button key={c} type="button" onClick={() => quick(c)}
              className="rounded-lg border border-white/15 bg-surface-2 py-2 text-sm font-mono font-semibold text-accent-2 hover:border-accent/50 hover:bg-white/5 transition">
              +{c.toLocaleString("ja-JP")}円
            </button>
          ))}
        </div>
      </div>
      <label className="block text-sm text-muted">
        上限額（{iAmTop ? `現在の上限 ${yen(myMax)} より上` : `${yen(base)} 以上`}）
        <input
          name="amount" type="number" inputMode="numeric" min={floor} step={1} required
          value={Number.isFinite(amount) ? amount : ""}
          onChange={(e) => setAmount(parseInt(e.target.value, 10))}
          className="input mt-1 text-xl font-mono tabular-nums !bg-[#080C14] !border-white/20"
        />
      </label>
      <button className="btn w-full text-lg !py-3 shadow-[0_0_20px_rgba(0,240,255,0.4)]">入札内容を確認する</button>
    </form>
  );
}
