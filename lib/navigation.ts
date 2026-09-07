"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

// =============================================
// タブ遷移の共通ロジック
//
// パララックス（奥行きのある遷移）は「古い画面と新しい画面を同時に、
// 違う速さで動かす」ことで成立する。ただしApp Routerでは遷移した時点で
// 古いページが消えるため、通常のCSSアニメーションでは再現できない。
// そこでブラウザ標準の View Transitions API を使う。
// この API は新旧のスナップショットを自動で用意してくれるので、
// 追加ライブラリなしで両方に別々のアニメーションを当てられる。
// =============================================

// ボトムナビの並び順。左右どちらへ動いたかの判定に使う
export const NAV_ORDER = [
  "/payslip",
  "/chart",
  "/annual",
  "/expenses",
  "/settings",
];

// パスがナビの何番目にあたるかを返す（該当なしは0）
export function navIndex(pathname: string): number {
  const i = NAV_ORDER.findIndex((p) => pathname.startsWith(p));
  return i === -1 ? 0 : i;
}

// startViewTransition はまだ全ブラウザ共通の型定義がないため最小限で補う
type ViewTransition = { finished: Promise<void> };
type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => ViewTransition;
};

// この環境で View Transitions API が使えるか
export function supportsViewTransition(): boolean {
  if (typeof document === "undefined") return false;
  return typeof (document as DocumentWithViewTransition).startViewTransition === "function";
}

// 新しいページの描画を待ちきれなかった場合の上限。
// これが無いと、何らかの理由で描画が完了しなかったときに
// 古い画面のスナップショットが residual して操作不能になる
const TRANSITION_TIMEOUT_MS = 700;

// =============================================
// パララックス付きでタブ遷移するためのフック
// 対応していない環境では通常の遷移にそのままフォールバックする
// =============================================
export function useParallaxNavigate() {
  const router = useRouter();
  const pathname = usePathname();
  // 遷移完了をトランジションへ伝えるための保留中のresolve
  const resolveRef = useRef<(() => void) | null>(null);

  // 使える環境ではhtmlに印を付ける。
  // CSS側でフォールバックのアニメーションを止めるために使う
  useEffect(() => {
    if (supportsViewTransition()) {
      document.documentElement.classList.add("vt-enabled");
    }
  }, []);

  // 新しいページが描画されたらトランジションを完了させる
  useEffect(() => {
    resolveRef.current?.();
    resolveRef.current = null;
  }, [pathname]);

  return useCallback(
    (href: string) => {
      if (href === pathname) return;

      // 進む方向か戻る方向かをCSSへ伝える
      const dir = navIndex(href) >= navIndex(pathname) ? "forward" : "back";
      document.documentElement.dataset.navDir = dir;

      const doc = document as DocumentWithViewTransition;
      if (!doc.startViewTransition) {
        router.push(href);
        return;
      }

      doc.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            const timer = window.setTimeout(() => {
              resolveRef.current = null;
              resolve();
            }, TRANSITION_TIMEOUT_MS);

            resolveRef.current = () => {
              window.clearTimeout(timer);
              resolve();
            };

            router.push(href);
          })
      );
    },
    [pathname, router]
  );
}
