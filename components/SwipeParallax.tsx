"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { NAV_ORDER, navIndex, useParallaxNavigate } from "@/lib/navigation";

// =============================================
// 指に追従する横スワイプ（パララックス付き）
//
// 外枠を指と同じだけ動かし、中身をその逆方向に少しだけ動かすことで
// 奥行きを出す。加えて離れるほど中身を縮小・減光させる。
// 指を離したら、しきい値を超えていれば隣のタブへ、
// 超えていなければ元の位置へ滑らかに戻す。
//
// 追従中はReactの状態を経由せずDOMへ直接transformを書き込む。
// 毎フレームの再レンダリングを避けるため（軽量・高速の方針）。
// =============================================

// 中身を外枠の何倍だけ逆方向へ動かすか（これがパララックスの正体）
const PARALLAX = 0.35;
// 端まで動かしたときに中身をどれだけ縮めるか
const SCALE_FALLOFF = 0.15;
// 端まで動かしたときにどれだけ薄くするか
const OPACITY_FALLOFF = 0.45;
// 画面幅のこの割合を超えて動かしたら遷移する
const COMMIT_RATIO = 0.25;
// 端のタブでそれ以上引っ張ったときの抵抗（ラバーバンド）
const RUBBER_BAND = 0.25;
// 軸（縦か横か）を判定し始める移動量
const AXIS_THRESHOLD = 6;
// スナップバックにかける時間
const SNAP_MS = 260;

export default function SwipeParallax({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const navigate = useParallaxNavigate();
  const shellRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    const inner = innerRef.current;
    if (!shell || !inner) return;

    let startX = 0;
    let startY = 0;
    let axis: "x" | "y" | null = null;
    let dragging = false;
    let pointerId: number | null = null;

    const width = () => shell.clientWidth || window.innerWidth || 1;

    // 現在のドラッグ量を画面へ反映する
    const apply = (dx: number) => {
      const ratio = Math.min(Math.abs(dx) / width(), 1);
      shell.style.transform = `translate3d(${dx}px, 0, 0)`;
      inner.style.transform = `translate3d(${-dx * PARALLAX}px, 0, 0) scale(${
        1 - ratio * SCALE_FALLOFF
      })`;
      inner.style.opacity = String(1 - ratio * OPACITY_FALLOFF);
    };

    // 変形を消して素の状態に戻す
    const clear = (animated: boolean) => {
      const transition = animated
        ? `transform ${SNAP_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${SNAP_MS}ms ease`
        : "";
      shell.style.transition = transition;
      inner.style.transition = transition;
      shell.style.transform = "";
      inner.style.transform = "";
      inner.style.opacity = "";
      if (animated) {
        window.setTimeout(() => {
          shell.style.transition = "";
          inner.style.transition = "";
        }, SNAP_MS);
      }
    };

    // その方向へ移動できるタブがあるか
    const targetFor = (dx: number): string | null => {
      if (!NAV_ORDER.some((p) => pathname.startsWith(p))) return null;
      const current = navIndex(pathname);
      // 左へ動かす＝次のタブ、右へ動かす＝前のタブ
      const next = dx < 0 ? current + 1 : current - 1;
      if (next < 0 || next >= NAV_ORDER.length) return null;
      return NAV_ORDER[next];
    };

    const handleDown = (e: PointerEvent) => {
      // マウスの右クリックやペン等は対象外
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      // 横スクロール領域やシートの上では動かさない
      if (target?.closest("[data-no-swipe]")) return;

      dragging = true;
      axis = null;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      shell.style.transition = "";
      inner.style.transition = "";
    };

    const handleMove = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // 最初のわずかな動きで縦か横かを決める。以後は変えない
      if (axis === null) {
        if (Math.abs(dx) < AXIS_THRESHOLD && Math.abs(dy) < AXIS_THRESHOLD) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        // 横と決まった時点でポインタを捕捉し、以降の動きを取りこぼさない
        if (axis === "x") shell.setPointerCapture(e.pointerId);
      }
      if (axis !== "x") return;

      // 行き先が無い方向は抵抗をつけて、端であることを手応えで伝える
      const resisted = targetFor(dx) ? dx : dx * RUBBER_BAND;
      apply(resisted);
    };

    const handleUp = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;
      pointerId = null;
      if (axis !== "x") return;

      const dx = e.clientX - startX;
      const href = targetFor(dx);
      const enough = Math.abs(dx) > width() * COMMIT_RATIO;

      if (href && enough) {
        // 変形を消してから遷移する。
        // View Transitionは直前の見た目をそのまま撮るため、
        // 傾いた状態のまま渡すと遷移アニメーションと二重に動いてしまう
        clear(false);
        navigate(href);
      } else {
        clear(true);
      }
    };

    shell.addEventListener("pointerdown", handleDown);
    shell.addEventListener("pointermove", handleMove);
    shell.addEventListener("pointerup", handleUp);
    shell.addEventListener("pointercancel", handleUp);
    return () => {
      shell.removeEventListener("pointerdown", handleDown);
      shell.removeEventListener("pointermove", handleMove);
      shell.removeEventListener("pointerup", handleUp);
      shell.removeEventListener("pointercancel", handleUp);
    };
  }, [pathname, navigate]);

  // 遷移が終わったら変形が残らないようにする
  useEffect(() => {
    if (shellRef.current) {
      shellRef.current.style.transform = "";
      shellRef.current.style.transition = "";
    }
    if (innerRef.current) {
      innerRef.current.style.transform = "";
      innerRef.current.style.opacity = "";
      innerRef.current.style.transition = "";
    }
  }, [pathname]);

  return (
    <div ref={shellRef} className="swipe-shell">
      <div ref={innerRef} className="swipe-inner">
        {children}
      </div>
    </div>
  );
}
