/**
 * サーバー起動時に一度だけ走る Next.js のフック。
 * 公開デモ（SEED_ON_START=1）では、出品が空なら起動時にデモデータを投入する。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SEED_ON_START !== "1") return;
  try {
    const { seedDemo } = await import("@/lib/seed-demo");
    const n = seedDemo(false);
    if (n > 0) console.log(`[seed-on-start] seeded ${n} listings.`);
  } catch (e) {
    console.error("[seed-on-start] failed", e);
  }
}
