"use client";

import { useState } from "react";

/** SNSシェア。Web Share API があれば共有、なければURLをコピー。 */
export default function ShareButton({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    const url = typeof window !== "undefined" ? window.location.origin + path : path;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch { /* キャンセル等は無視 */ }
  };
  return (
    <button type="button" onClick={onClick} aria-label="共有" className="h-9 w-9 rounded-full border border-white/15 bg-surface-2 text-muted hover:text-accent-2 hover:border-accent/50 transition text-sm">
      {copied ? "✓" : "↗"}
    </button>
  );
}
