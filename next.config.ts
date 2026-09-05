import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ネイティブNode.jsモジュールはサーバー側のみで実行
  serverExternalPackages: ["pdf-parse", "tesseract.js"],
  experimental: {
    // CSSをHTMLに埋め込む。別ファイルの取得を待たずに初回描画できるため、
    // 起動直後のスプラッシュ表示が速くなる
    inlineCss: true,
  },
  turbopack: {
    // このプロジェクトのルートを明示（ワークスペース警告を抑制）
    root: __dirname,
  },
};

export default nextConfig;
