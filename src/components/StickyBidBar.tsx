"use client";

/** スマホ下部に固定する入札バー。現在価格＋「入札する」。タップで入札パネルへスクロール。 */
export default function StickyBidBar({ price, label = "入札する" }: { price: number; label?: string }) {
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#080C14]/92 backdrop-blur-md border-t border-white/10 p-3">
      <div className="mx-auto max-w-5xl flex items-center gap-3">
        <div className="min-w-0">
          <div className="text-[10px] text-muted leading-none">現在価格</div>
          <div className="font-mono tabular-nums text-xl font-extrabold text-accent leading-tight">{price.toLocaleString("ja-JP")} 円</div>
        </div>
        <a href="#bid" className="btn ml-auto !px-6 !py-2.5 shadow-[0_0_20px_rgba(0,240,255,0.4)]">{label}</a>
      </div>
    </div>
  );
}
