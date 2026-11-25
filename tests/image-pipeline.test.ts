import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { processUploadImage } from "../src/lib/image-pipeline.ts";

/** GPS座標・撮影日時・端末名を埋め込んだ巨大JPEG（2400×1800）を作る。 */
async function makeJpegWithGps(): Promise<Buffer> {
  return sharp({ create: { width: 2400, height: 1800, channels: 3, background: { r: 30, g: 140, b: 210 } } })
    .withExif({
      IFD0: { Model: "Pixel-GPS-Test", Make: "GoogleTest", Software: "banshu", DateTime: "2026:01:01 10:00:00" },
      // IFD3 = GPS。緯度経度を入れておき、処理後に消えていることを確認する
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "34/1 49/1 1200/100", GPSLongitudeRef: "E", GPSLongitude: "134/1 41/1 3000/100" },
    })
    .jpeg()
    .toBuffer();
}

test("入力JPEGにはGPS/EXIF（端末名）が埋め込まれている（前提の確認）", async () => {
  const input = await makeJpegWithGps();
  const meta = await sharp(input).metadata();
  assert.equal(meta.format, "jpeg");
  assert.ok(meta.exif && meta.exif.length > 0, "入力にEXIFが存在すること");
  assert.ok(meta.exif.includes("Pixel-GPS-Test"), "EXIFに端末名が含まれること");
  assert.ok(input.includes("Pixel-GPS-Test"), "生バイト列にも端末名が含まれること");
});

test("処理後の画像から位置情報・EXIFが完全に消去されている", async () => {
  const input = await makeJpegWithGps();
  const { buffer } = await processUploadImage(input);
  const meta = await sharp(buffer).metadata();

  // メタデータ（EXIF＝GPS・撮影日時・端末名を含む）が一切残っていないこと
  assert.equal(meta.exif, undefined, "出力にEXIFが残っていないこと");
  assert.equal(meta.icc, undefined, "出力にICCプロファイル等も残っていないこと");
  // 端末名の文字列がバイト列から消えていること（＝GPSを含むEXIFブロックごと除去）
  assert.ok(!buffer.includes("Pixel-GPS-Test"), "出力バイト列に端末名が残っていないこと");
  assert.ok(!buffer.includes("GoogleTest"), "出力バイト列に製造元が残っていないこと");
});

test("WebP形式で出力され、長辺1600pxにリサイズされる", async () => {
  const input = await makeJpegWithGps();
  const { buffer, ext, width, height } = await processUploadImage(input);

  const meta = await sharp(buffer).metadata();
  assert.equal(meta.format, "webp", "WebP形式で出力されること");
  assert.equal(ext, "webp");
  // 2400×1800 → 長辺1600に収まる（1600×1200）
  assert.ok(width <= 1600 && height <= 1600, "長辺が1600px以内にリサイズされること");
  assert.equal(width, 1600, "横2400は1600へ縮小されること");
  assert.equal(height, 1200, "比率を維持して高さは1200になること");
  // 最適化で容量が小さくなっていること
  assert.ok(buffer.length < input.length, "変換後の容量が元より小さいこと");
});

test("小さい画像は拡大されない（長辺未満はそのまま）", async () => {
  const small = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 10, g: 10, b: 10 } } }).jpeg().toBuffer();
  const { width, height } = await processUploadImage(small);
  assert.equal(width, 800, "元が小さい場合は拡大しないこと");
  assert.equal(height, 600);
});
