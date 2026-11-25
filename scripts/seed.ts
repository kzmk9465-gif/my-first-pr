/**
 * デモデータ投入スクリプト。
 *   npm run seed
 * 既に出品がある場合は何もしない（--force で追加）。
 */
import { seedDemo } from "../src/lib/seed-demo.ts";

const force = process.argv.includes("--force");
const n = seedDemo(force);
console.log(n > 0 ? `seeded ${n} listings.` : "listings already exist. use --force to add more.");
