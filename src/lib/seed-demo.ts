import { getDb } from "./db.ts";

/**
 * デモデータ（出品者・出品）を投入する。
 * 既に出品があれば何もしない（force=true で追加）。投入した出品数を返す。
 * scripts/seed.ts（手動投入）と instrumentation.ts（公開デモの起動時投入）の両方から使う。
 */
export function seedDemo(force = false): number {
  const db = getDb();
  const count = (db.prepare("SELECT COUNT(*) AS c FROM listings").get() as { c: number }).c;
  if (count > 0 && !force) return 0;

  const sellers: [string, string, string][] = [
    ["播州めだか", "banshu-medaka", "兵庫・播州の自家繁殖メダカ。原作出個体と委託品を出品します。"],
    ["委託：姫路めだか園", "himeji-medakaen", "委託出品（販売証明付き）"],
  ];
  for (const [name, slug, desc] of sellers) {
    db.prepare("INSERT OR IGNORE INTO sellers (name, slug, description) VALUES (?, ?, ?)").run(name, slug, desc);
  }
  const sid = (slug: string) => (db.prepare("SELECT id FROM sellers WHERE slug = ?").get(slug) as { id: number }).id;
  // デモ: オンライン決済を有効化（本番は出品者/管理画面の設定で切替）
  db.prepare("UPDATE sellers SET accepts_online = 1").run();

  const h = 3600_000;
  const now = Date.now();
  const items = [
    { s: "banshu-medaka", title: "播州めだか) 三色ラメ幹之 1ペア", variety: "三色ラメ幹之", breeder: "播州めだか", cert: "original", qty: "1ペア", price: 1000, ends: 26 * h, featured: 1, hot: 1 },
    { s: "banshu-medaka", title: "播州めだか) 夜桜ゴールド オス1メス2", variety: "夜桜", breeder: "播州めだか", cert: "original", qty: "オス1メス2", price: 1200, ends: 27 * h, featured: 0, hot: 0 },
    { s: "banshu-medaka", title: "播州めだか) 紅帝ラメ 1ペア（サ）", variety: "紅帝", breeder: "播州めだか", cert: "bloodline", qty: "1ペア", price: 1100, ends: 50 * h, featured: 0, hot: 1 },
    { s: "himeji-medakaen", title: "姫路めだか園) オロチラメ 1ペア MLサイズ", variety: "オロチ", breeder: "姫路めだか園", cert: "sales", qty: "1ペア", price: 1000, ends: 3 * h, featured: 0, hot: 0 },
    { s: "himeji-medakaen", title: "姫路めだか園) 王華 1ペア", variety: "王華", breeder: "姫路めだか園", cert: "sales", qty: "1ペア", price: 2000, ends: 75 * h, featured: 0, hot: 0 },
    { s: "banshu-medaka", title: "播州めだか) 黒ラメ黄幹之 若魚5匹", variety: "黒ラメ黄幹之", breeder: "播州めだか", cert: "original", qty: "5匹", price: 1500, ends: 0.25 * h, featured: 0, hot: 0 },
  ];
  const ins = db.prepare(
    `INSERT INTO listings (seller_id, title, variety, breeder, certificate, quantity, description, start_price, current_price, bid_increment, starts_at, ends_at, status, featured, hot, sudden_death)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 100, ?, ?, 'open', ?, ?, 1)`,
  );
  for (const it of items) {
    ins.run(
      sid(it.s), it.title, it.variety, it.breeder, it.cert, it.qty,
      "サイズ：若魚〜成魚\n発送：ヤマト運輸（生体）。死着保証は到着後2時間以内に写真でご連絡ください。\n※画像は親魚または同系統の個体です。",
      it.price, it.price, new Date(now - 24 * h).toISOString(), new Date(now + it.ends).toISOString(), it.featured, it.hot,
    );
  }
  return items.length;
}
