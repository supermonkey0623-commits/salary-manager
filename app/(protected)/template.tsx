"use client";

import { usePathname } from "next/navigation";

// ボトムナビの並び順。この順序で進行方向（左右）を決める
const NAV_ORDER = ["/payslip", "/chart", "/annual", "/expenses", "/settings"];

// template はページ遷移のたびに再マウントされるため、
// 直前の位置はモジュール変数（マウントをまたいで保持される）で覚えておく
let lastIndex = 0;

// パスがナビの何番目にあたるかを返す（該当なしは0）
function navIndex(pathname: string): number {
  const i = NAV_ORDER.findIndex((p) => pathname.startsWith(p));
  return i === -1 ? 0 : i;
}

// =============================================
// 画面遷移アニメーション
// template.tsx は遷移ごとに必ず再マウントされるので、
// 4つのタブすべてで確実にアニメーションが再生される。
// 右のタブへ移動＝右から、左のタブへ移動＝左からスライドインする。
// =============================================
export default function ProtectedTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const next = navIndex(pathname);
  const dir = next >= lastIndex ? "right" : "left";
  lastIndex = next;

  return (
    <div className={dir === "right" ? "page-enter-right" : "page-enter-left"}>
      {children}
    </div>
  );
}
