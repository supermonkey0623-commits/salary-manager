"use client";

import { usePathname } from "next/navigation";
import { navIndex } from "@/lib/navigation";

// template はページ遷移のたびに再マウントされるため、
// 直前の位置はモジュール変数（マウントをまたいで保持される）で覚えておく
let lastIndex = 0;

// =============================================
// 画面遷移アニメーション（フォールバック）
//
// View Transitions API が使える環境では、より奥行きのあるパララックス遷移
// （lib/navigation.ts + globals.css）が動くため、こちらのスライドは
// CSS側（html.vt-enabled）で無効化される。
// 未対応のブラウザではこの簡易スライドが受け皿になる。
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
