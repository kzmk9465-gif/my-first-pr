/** 印章（落款）風のブランドマーク。オリジナルの意匠。 */
export default function Seal({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden role="img">
      <defs>
        <linearGradient id="seal-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7D885" />
          <stop offset="1" stopColor="#a8842a" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22.2" fill="none" stroke="url(#seal-gold)" strokeWidth="1.4" />
      <circle cx="24" cy="24" r="18.4" fill="none" stroke="url(#seal-gold)" strokeWidth="0.8" opacity="0.7" />
      <text x="24" y="31.5" textAnchor="middle" fontFamily="'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif"
            fontWeight="900" fontSize="23" fill="url(#seal-gold)">播</text>
    </svg>
  );
}
