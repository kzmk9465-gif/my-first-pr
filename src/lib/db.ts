import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "auction.sqlite");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  line_user_id TEXT,
  shipping_name TEXT,
  shipping_postal TEXT,
  shipping_address TEXT,
  shipping_phone TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS sellers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES sellers(id),
  title TEXT NOT NULL,
  variety TEXT,
  breeder TEXT,
  certificate TEXT,
  quantity TEXT,
  description TEXT,
  image_url TEXT,
  start_price INTEGER NOT NULL,
  current_price INTEGER NOT NULL,
  bid_increment INTEGER NOT NULL DEFAULT 100,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  winner_id INTEGER REFERENCES users(id),
  featured INTEGER NOT NULL DEFAULT 0,
  hot INTEGER NOT NULL DEFAULT 0,
  extended_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_listings_status_ends ON listings(status, ends_at);
CREATE TABLE IF NOT EXISTS bids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_bids_listing ON bids(listing_id, amount DESC);
CREATE TABLE IF NOT EXISTS follows (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, seller_id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE TABLE IF NOT EXISTS max_bids (
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  max_amount INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (listing_id, user_id)
);
CREATE TABLE IF NOT EXISTS lost_bids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  price_after INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_lost_bids_user ON lost_bids(user_id, id DESC);
CREATE TABLE IF NOT EXISTS orders (
  listing_id INTEGER PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES users(id),
  seller_id INTEGER NOT NULL REFERENCES sellers(id),
  status TEXT NOT NULL DEFAULT 'awaiting_payment',
  price INTEGER NOT NULL,
  shipping_fee INTEGER NOT NULL DEFAULT 0,
  shipping_method TEXT,
  fee_rate INTEGER NOT NULL DEFAULT 0,
  carrier TEXT,
  tracking_no TEXT,
  note TEXT,
  paid_at TEXT,
  shipped_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id, status);
CREATE TABLE IF NOT EXISTS listing_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'sale',
  status TEXT NOT NULL DEFAULT 'issued',
  listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
  parent_id INTEGER REFERENCES certificates(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  holder_name TEXT,
  title TEXT NOT NULL,
  variety TEXT,
  breeder TEXT,
  seller_name TEXT,
  price INTEGER,
  note TEXT,
  issued_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);
CREATE TABLE IF NOT EXISTS listing_unlocks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, listing_id)
);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  kind TEXT NOT NULL DEFAULT 'user',
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_listing ON comments(listing_id, id);
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'news',
  title TEXT NOT NULL,
  body TEXT,
  image_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS varieties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  breeder_name TEXT,
  prefecture TEXT,
  instagram TEXT,
  description TEXT,
  image_url TEXT,
  traits TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS contests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'entry',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS contest_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contest_id INTEGER NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  image_url TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS contest_votes (
  contest_id INTEGER NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  entry_id INTEGER NOT NULL REFERENCES contest_entries(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (contest_id, user_id)
);
CREATE TABLE IF NOT EXISTS point_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  day TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_logs_bonus ON point_logs(user_id, reason, day);
CREATE TABLE IF NOT EXISTS gacha_prizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  stock INTEGER,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS gacha_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  prize_id INTEGER REFERENCES gacha_prizes(id),
  prize_name TEXT NOT NULL,
  won INTEGER NOT NULL DEFAULT 0,
  fulfilled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  handled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES users(id),
  seller_id INTEGER NOT NULL REFERENCES sellers(id),
  amount INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'mock',
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_listing ON payments(listing_id);
CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, listing_id)
);
CREATE TABLE IF NOT EXISTS oripa_draws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL,
  rarity TEXT NOT NULL,
  prize_name TEXT NOT NULL,
  ref_price INTEGER NOT NULL DEFAULT 0,
  redeem_pt INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'won',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_oripa_pkg ON oripa_draws(package_id);
CREATE INDEX IF NOT EXISTS idx_oripa_user ON oripa_draws(user_id);
-- 播州くじ（第7段階・確定版）：有限の箱。総口数と各賞の本数を先に決め、引いた分だけ減る
CREATE TABLE IF NOT EXISTS oripa_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  price_yen INTEGER NOT NULL,
  total INTEGER NOT NULL,
  hue1 TEXT NOT NULL DEFAULT '#0ea5b7',
  hue2 TEXT NOT NULL DEFAULT '#0284C7',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS oripa_prizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id INTEGER NOT NULL REFERENCES oripa_packages(id) ON DELETE CASCADE,
  rarity TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'medaka',
  ref_price INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  count_total INTEGER NOT NULL,
  count_left INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oripa_prizes_pkg ON oripa_prizes(package_id);
-- 口の購入（汎用ポイントは売らない。特定のくじの口を都度買う）
CREATE TABLE IF NOT EXISTS oripa_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  package_id INTEGER NOT NULL REFERENCES oripa_packages(id),
  count INTEGER NOT NULL,
  amount_yen INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'bank',
  status TEXT NOT NULL DEFAULT 'pending',
  drawn INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_oripa_orders_user ON oripa_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_oripa_orders_pkg ON oripa_orders(package_id, status);
`;

/** 既存DBに後から追加した列（ALTER TABLE は IF NOT EXISTS が無いので手動で確認） */
const COLUMN_MIGRATIONS: [table: string, column: string, ddl: string][] = [
  ["users", "status", "TEXT NOT NULL DEFAULT 'pending'"],
  ["users", "shop_name", "TEXT"],
  ["users", "instagram", "TEXT"],
  ["users", "approved_at", "TEXT"],
  ["listings", "sudden_death", "INTEGER NOT NULL DEFAULT 0"],
  ["bids", "is_auto", "INTEGER NOT NULL DEFAULT 0"],
  // 第2段階：フロント出品・出品者ダッシュボード
  ["sellers", "user_id", "INTEGER REFERENCES users(id)"],
  ["sellers", "pin_hash", "TEXT"],
  ["sellers", "fee_rate", "INTEGER NOT NULL DEFAULT 10"],
  ["sellers", "shipping_normal", "INTEGER NOT NULL DEFAULT 1000"],
  ["sellers", "shipping_cool", "INTEGER NOT NULL DEFAULT 1500"],
  ["sellers", "payment_info", "TEXT"],
  ["listings", "buyout_price", "INTEGER"],
  ["listings", "subtitle", "TEXT"],
  ["listings", "images", "TEXT"],
  ["listings", "video_url", "TEXT"],
  ["listings", "shipping_method", "TEXT NOT NULL DEFAULT 'normal'"],
  ["listings", "shipping_fee", "INTEGER NOT NULL DEFAULT 0"],
  ["listings", "fee_rate", "INTEGER NOT NULL DEFAULT 0"],
  ["listings", "created_by", "INTEGER REFERENCES users(id)"],
  // 第3段階：闇市・限定・千両箱
  ["listings", "min_rank", "INTEGER NOT NULL DEFAULT 0"],
  ["listings", "passphrase_hash", "TEXT"],
  ["listings", "mystery", "INTEGER NOT NULL DEFAULT 0"],
  // 第4段階：弾幕コメント
  ["listings", "comments_enabled", "INTEGER NOT NULL DEFAULT 1"],
  // 第5段階
  ["users", "prefecture", "TEXT"],
  // 第6段階：オンライン決済
  ["sellers", "accepts_online", "INTEGER NOT NULL DEFAULT 0"],
  ["orders", "paid_via", "TEXT"],
  // 第7段階：播州くじ確定版（年齢確認・有限の箱・口の購入）
  ["users", "birthdate", "TEXT"],
  ["oripa_draws", "order_id", "INTEGER REFERENCES oripa_orders(id)"],
  ["oripa_draws", "prize_id", "INTEGER REFERENCES oripa_prizes(id)"],
  ["oripa_draws", "kind", "TEXT NOT NULL DEFAULT 'medaka'"],
  ["oripa_orders", "shipping_yen", "INTEGER NOT NULL DEFAULT 0"],
];

function migrate(db: DatabaseSync): void {
  for (const [table, column, ddl] of COLUMN_MIGRATIONS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

function open(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

// 開発時のホットリロードで接続が増えないように globalThis に保持する
const g = globalThis as unknown as { __banshuDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (!g.__banshuDb) g.__banshuDb = open();
  return g.__banshuDb;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** BEGIN IMMEDIATE で排他的にトランザクションを実行する */
export function transaction<T>(fn: (db: DatabaseSync) => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn(db);
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
