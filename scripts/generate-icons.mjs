// =============================================
// PWAアイコン生成スクリプト
// 実行: node scripts/generate-icons.mjs
// public/ に 192px / 512px の通常版と maskable 版を出力する
// ¥マークはフォント非依存のパス描画（環境によらず同じ見た目になる）
// =============================================
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

// 出力先ディレクトリを確保する
await mkdir("public", { recursive: true });

// 青グラデーション背景（アプリのテーマカラー）
const GRADIENT = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2563eb"/>
      <stop offset="1" stop-color="#1e40af"/>
    </linearGradient>
  </defs>`;

// ¥マーク（512pxキャンバス基準・ストローク描画）
const YEN_MARK = `
  <g stroke="#ffffff" stroke-width="42" stroke-linecap="round" fill="none">
    <path d="M156 122 L256 268"/>
    <path d="M356 122 L256 268"/>
    <path d="M256 268 L256 408"/>
    <path d="M172 306 L340 306"/>
    <path d="M172 362 L340 362"/>
  </g>`;

// 通常版：角丸スクエア（ブラウザUIなどでそのまま表示される）
const svgAny = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  ${GRADIENT}
  <rect x="0" y="0" width="512" height="512" rx="115" fill="url(#g)"/>
  ${YEN_MARK}
</svg>`;

// maskable版：全面塗り＋セーフゾーン（中央80%）に収まるよう縮小
const svgMaskable = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  ${GRADIENT}
  <rect x="0" y="0" width="512" height="512" fill="url(#g)"/>
  <g transform="translate(51.2 51.2) scale(0.8)">${YEN_MARK}</g>
</svg>`;

// SVG文字列を指定サイズのPNGとして書き出す
async function writePng(svg, size, path) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path);
  console.log(`生成完了: ${path}`);
}

await writePng(svgAny, 192, "public/icon-192.png");
await writePng(svgAny, 512, "public/icon-512.png");
await writePng(svgMaskable, 192, "public/icon-maskable-192.png");
await writePng(svgMaskable, 512, "public/icon-maskable-512.png");
