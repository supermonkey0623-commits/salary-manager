import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ネイティブNode.jsモジュールはサーバー側のみで実行
  serverExternalPackages: ["pdf-parse", "tesseract.js"],
  turbopack: {
    // このプロジェクトのルートを明示（ワークスペース警告を抑制）
    root: __dirname,
  },
};

export default nextConfig;
