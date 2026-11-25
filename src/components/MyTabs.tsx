"use client";

import { useState, type ReactNode } from "react";

export type TabDef = { key: string; label: string; count: number; node: ReactNode };

/** マイページの3大タブ。件数バッジ付き・スマホで追従する高密度タブバー。 */
export default function MyTabs({ tabs, initial }: { tabs: TabDef[]; initial?: string }) {
  const [active, setActive] = useState(() => (tabs.some((t) => t.key === initial) ? (initial as string) : tabs[0]?.key));

  return (
    <div>
      <div className="sticky top-14 z-20 -mx-4 px-4 py-2 bg-background/92 backdrop-blur-md border-b border-white/10">
        <div className="grid grid-cols-3 gap-2">
          {tabs.map((t) => {
            const on = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActive(t.key)}
                aria-pressed={on}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm font-bold transition ${
                  on
                    ? "bg-accent/15 text-accent-2 border-accent/45 shadow-[0_0_18px_-6px_rgba(0,240,255,0.5)]"
                    : "bg-[#182234] text-muted border-white/10 hover:text-foreground"
                }`}
              >
                <span className="truncate">{t.label}</span>
                <span
                  className={`font-mono tabular-nums text-xs rounded-full px-1.5 py-0.5 leading-none ${
                    on ? "bg-accent/25 text-accent-2" : "bg-white/10 text-muted"
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4">
        {tabs.map((t) => (
          <div key={t.key} className={t.key === active ? "" : "hidden"}>
            {t.node}
          </div>
        ))}
      </div>
    </div>
  );
}
