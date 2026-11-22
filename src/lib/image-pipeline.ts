import sharp from "sharp";

/**
 * 出品画像の安全化・最適化パイプライン。
 *
 * メダカの出品写真には、スマホのEXIFに撮影場所のGPS座標・撮影日時・端末名が
 * 埋め込まれていることが多い。これをそのまま公開すると養魚場の特定や盗難に
 * つながるため、保存前にサーバー側で必ず無害化する。あわせて表示を速くする。
 *
 * 1. EXIF/GPS/撮影日時/端末名を完全に除去（sharp は出力時に明示しない限り
 *    メタデータを引き継がない。rotate() で向きだけ画素に焼き込んでから破棄する）
 * 2. WebP へ変換して軽量化（quality 80）
 * 3. 長辺を既定 1600px までリサイズ（拡大はしない・比率維持）
 */

export const IMAGE_MAX_EDGE = 1600;
export const IMAGE_WEBP_QUALITY = 80;

export type ProcessedImage = { buffer: Buffer; ext: "webp"; width: number; height: number };

export type ProcessOptions = {
  /** 長辺の最大px（既定 1600）。これより小さい画像は拡大しない。 */
  maxEdge?: number;
  /** WebP 品質 1-100（既定 80）。 */
  quality?: number;
  /** アニメーション（GIF 等）の全フレームを保持する。 */
  animated?: boolean;
};

/**
 * 画像バッファを安全化・最適化した WebP バッファに変換する。
 * 破損画像など処理できない入力は例外を投げる（呼び出し側で握りつぶす）。
 */
export async function processUploadImage(input: Buffer, opts: ProcessOptions = {}): Promise<ProcessedImage> {
  const maxEdge = opts.maxEdge ?? IMAGE_MAX_EDGE;
  const quality = opts.quality ?? IMAGE_WEBP_QUALITY;
  const animated = opts.animated ?? false;

  const { data, info } = await sharp(input, { animated, failOn: "none" })
    // EXIF の向き情報を画素へ反映してから（この後メタデータごと破棄するため）
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    // withMetadata()/keepExif() を呼ばない＝EXIF・GPS・ICC等を一切引き継がない
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });

  return { buffer: data, ext: "webp", width: info.width, height: info.height };
}
