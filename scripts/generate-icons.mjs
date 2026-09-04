// =============================================
// アプリアイコン・スプラッシュ画像の生成スクリプト
// 実行: node scripts/generate-icons.mjs
//
// ・アイコン（ブタの貯金箱）を public/ と app/ に出力
// ・iOS PWA用のスプラッシュ画像を public/splash/ に出力
// フォント非依存の図形描画のみで構成し、環境によらず同じ絵柄になるようにする
// =============================================
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

await mkdir("public/splash", { recursive: true });

// ---- 配色 ----
const BODY = "#F79FC0";      // 胴体
const ACCENT = "#EF87AF";    // 耳・鼻
const LEG = "#E87BA6";       // 脚
const DARK = "#C94F7E";      // 鼻の穴
const SLOT = "#D45F8C";      // コイン投入口
const EYE = "#3D2A33";       // 目

// 512×512の座標系で描いたブタの貯金箱
// 重ね順：脚 → 耳 → 胴体 → 投入口・目・鼻
const PIG = `
  <g>
    <rect x="146" y="350" width="82" height="106" rx="36" fill="${LEG}"/>
    <rect x="284" y="350" width="82" height="106" rx="36" fill="${LEG}"/>

    <path d="M142 178 L196 98 L246 172 Z" fill="${ACCENT}"
          stroke="${ACCENT}" stroke-width="30" stroke-linejoin="round"/>
    <path d="M370 178 L316 98 L266 172 Z" fill="${ACCENT}"
          stroke="${ACCENT}" stroke-width="30" stroke-linejoin="round"/>

    <ellipse cx="256" cy="268" rx="178" ry="150" fill="${BODY}"/>

    <rect x="198" y="142" width="116" height="22" rx="11" fill="${SLOT}"/>

    <circle cx="198" cy="250" r="17" fill="${EYE}"/>
    <circle cx="314" cy="250" r="17" fill="${EYE}"/>

    <ellipse cx="256" cy="322" rx="66" ry="50" fill="${ACCENT}"/>
    <ellipse cx="234" cy="322" rx="11" ry="15" fill="${DARK}"/>
    <ellipse cx="278" cy="322" rx="11" ry="15" fill="${DARK}"/>
  </g>`;

// 背景のグラデーション定義（淡いピンク）
const BG_DEF = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFF3F8"/>
      <stop offset="1" stop-color="#FFE1EC"/>
    </linearGradient>
  </defs>`;

// 通常アイコン：角丸の座布団にブタを乗せる
const iconSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  ${BG_DEF}
  <rect width="512" height="512" rx="115" fill="url(#bg)"/>
  ${PIG}
</svg>`;

// maskableアイコン：全面を塗り、絵柄は中央80%のセーフゾーンに収める
const maskableSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  ${BG_DEF}
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(51.2 51.2) scale(0.8)">${PIG}</g>
</svg>`;

// スプラッシュ：白地の中央にブタだけを置く（文字はアプリ側で描画する）
function splashSvg(width, height) {
  // 短辺の38%をロゴの大きさにする
  const logo = Math.round(Math.min(width, height) * 0.38);
  const scale = logo / 512;
  const tx = (width - logo) / 2;
  const ty = (height - logo) / 2;
  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#FFFFFF"/>
  <g transform="translate(${tx} ${ty}) scale(${scale})">${PIG}</g>
</svg>`;
}

// SVG文字列を指定サイズのPNGとして書き出す
async function writePng(svg, size, path) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path);
  console.log(`生成: ${path} (${size}x${size})`);
}

// ---- アイコン ----
await writePng(iconSvg, 192, "public/icon-192.png");
await writePng(iconSvg, 512, "public/icon-512.png");
await writePng(maskableSvg, 192, "public/icon-maskable-192.png");
await writePng(maskableSvg, 512, "public/icon-maskable-512.png");

// Next.jsのファイル規約：app/icon.png（ファビコン）と app/apple-icon.png（iOSホーム画面）
await writePng(iconSvg, 192, "app/icon.png");
await writePng(iconSvg, 180, "app/apple-icon.png");

// ---- iOS スプラッシュ（端末ごとの実解像度） ----
const SPLASH_SIZES = [
  [1320, 2868], // iPhone 16 Pro Max
  [1206, 2622], // iPhone 16 Pro
  [1290, 2796], // iPhone 15/14 Pro Max
  [1179, 2556], // iPhone 15/14 Pro
  [1284, 2778], // iPhone 13/12 Pro Max
  [1170, 2532], // iPhone 13/12
  [1242, 2688], // iPhone 11 Pro Max / XS Max
  [828, 1792],  // iPhone 11 / XR
  [1125, 2436], // iPhone X / XS / 11 Pro
  [1242, 2208], // iPhone 8 Plus
  [750, 1334],  // iPhone SE / 8
];

for (const [w, h] of SPLASH_SIZES) {
  const file = `public/splash/splash-${w}-${h}.png`;
  await sharp(Buffer.from(splashSvg(w, h))).png().toFile(file);
  console.log(`生成: ${file}`);
}

console.log("完了");
