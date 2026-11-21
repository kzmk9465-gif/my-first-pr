import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { siteConfig } from "./config.ts";

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export function uploadDir(): string {
  const dir = siteConfig.uploadDir || path.join(process.cwd(), "data", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 画像ファイルを保存して公開URL（/api/uploads/<name>）を返す */
export async function saveImage(file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ext = TYPES[file.type];
  if (!ext) return { ok: false, error: "画像は JPEG / PNG / WebP / GIF のみ対応です。" };
  if (file.size > MAX_BYTES) return { ok: false, error: "画像は1枚8MBまでです。" };
  const buf = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(buf, ext)) return { ok: false, error: "画像ファイルとして読み取れませんでした。" };
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(uploadDir(), name), buf);
  return { ok: true, url: `/api/uploads/${name}` };
}

function looksLikeImage(buf: Buffer, ext: string): boolean {
  if (buf.length < 12) return false;
  if (ext === "jpg") return buf[0] === 0xff && buf[1] === 0xd8;
  if (ext === "png") return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === "gif") return buf.subarray(0, 3).toString() === "GIF";
  if (ext === "webp") return buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
  return false;
}

export function readUpload(name: string): { body: Buffer; type: string } | null {
  if (!/^[a-z0-9-]+\.(jpg|png|webp|gif)$/.test(name)) return null;
  const p = path.join(uploadDir(), name);
  if (!fs.existsSync(p)) return null;
  const ext = name.split(".").pop()!;
  const type = Object.entries(TYPES).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
  return { body: fs.readFileSync(p), type };
}
