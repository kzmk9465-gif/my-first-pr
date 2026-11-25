import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // コンテナ単体で起動できる最小構成を出力（Dockerデプロイ用）
  output: "standalone",
  // 出品の画像アップロード（最大6枚×8MB）が Server Actions を通るので上限を上げる
  experimental: {
    serverActions: { bodySizeLimit: "60mb" },
  },
};

export default nextConfig;
