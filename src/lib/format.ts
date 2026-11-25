const TZ = "Asia/Tokyo";

export function yen(n: number): string {
  return `${n.toLocaleString("ja-JP")} 円`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatShort(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TZ,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** 残り時間を「2日3時間」「15分」のように表示する */
export function remaining(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return "終了";
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d >= 1) return `残り${d}日${h % 24}時間`;
  if (h >= 1) return `残り${h}時間${m % 60}分`;
  if (m >= 1) return `残り${m}分`;
  return "残り1分未満";
}

/** <input type="datetime-local"> 用に日本時間の値を作る */
export function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

/** datetime-local（日本時間）の値を ISO(UTC) に変換する */
export function fromLocalInputValue(v: string): string {
  // v = "2026-11-23T21:30" を JST として解釈
  return new Date(`${v}:00+09:00`).toISOString();
}
