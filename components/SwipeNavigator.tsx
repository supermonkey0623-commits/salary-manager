"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

// ボトムナビと同じ並び順。スワイプで隣のタブへ移動する
const NAV_ORDER = ["/payslip", "/chart", "/annual", "/expenses", "/settings"];

// 遷移と判定する最小の横移動量（px）
const MIN_DISTANCE = 55;
// 縦移動に対して横移動がこの倍率以上のときだけ横スワイプとみなす
// （縦スクロールを誤って遷移と判定しないため）
const HORIZONTAL_RATIO = 1.4;
// これより長い操作は「スワイプ」ではなくスクロール等とみなす（ms）
const MAX_DURATION = 800;

// =============================================
// スワイプによるタブ移動
// 画面のどこを触っても、左右にスワイプすれば隣のタブへ移動する。
// 横スクロールする要素やシート類の上では無効にするため、
// それらには data-no-swipe を付けてある。
// =============================================
export default function SwipeNavigator() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let startedAt = 0;
    let tracking = false;

    const handleStart = (e: TouchEvent) => {
      // 2本指以上（ピンチ等）は対象外
      if (e.touches.length !== 1) {
        tracking = false;
        return;
      }
      const target = e.target as HTMLElement | null;
      // 横スクロール領域やシートの上では遷移させない
      if (target?.closest("[data-no-swipe]")) {
        tracking = false;
        return;
      }
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startedAt = Date.now();
      tracking = true;
    };

    const handleEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;

      if (Date.now() - startedAt > MAX_DURATION) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      // 移動量が足りない、または縦方向の動きが大きい場合は無視
      if (Math.abs(dx) < MIN_DISTANCE) return;
      if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return;

      const current = NAV_ORDER.findIndex((p) => pathname.startsWith(p));
      if (current === -1) return;

      // 左へスワイプ＝次のタブ、右へスワイプ＝前のタブ
      const nextIndex = dx < 0 ? current + 1 : current - 1;
      if (nextIndex < 0 || nextIndex >= NAV_ORDER.length) return;

      router.push(NAV_ORDER[nextIndex]);
    };

    document.addEventListener("touchstart", handleStart, { passive: true });
    document.addEventListener("touchend", handleEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleStart);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [pathname, router]);

  return null;
}
