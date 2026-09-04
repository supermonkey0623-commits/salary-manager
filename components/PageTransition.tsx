"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

// ボトムナビの並び順。この順序で進行方向（左右）を決める
const NAV_ORDER = ["/payslip", "/chart", "/annual", "/settings"];

// パスがナビの何番目にあたるかを返す（該当なしは0）
function navIndex(pathname: string): number {
  const i = NAV_ORDER.findIndex((p) => pathname.startsWith(p));
  return i === -1 ? 0 : i;
}

// =============================================
// 画面遷移アニメーション
// 右のタブへ移動＝右から、左のタブへ移動＝左からスライドインする
// =============================================
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  // 直前のパスを保持し、描画中に方向を確定させる
  // （useEffectで更新すると初回フレームの向きがずれるため）
  const pathname = usePathname();
  const [state, setState] = useState({
    path: pathname,
    dir: "right" as "right" | "left",
  });

  if (state.path !== pathname) {
    const next = navIndex(pathname);
    const prev = navIndex(state.path);
    setState({ path: pathname, dir: next >= prev ? "right" : "left" });
  }

  return (
    <div
      key={pathname}
      className={state.dir === "right" ? "page-enter-right" : "page-enter-left"}
    >
      {children}
    </div>
  );
}
