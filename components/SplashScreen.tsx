"use client";

import { useEffect, useState } from "react";
import { onAppReady } from "@/lib/appReady";

// =============================================
// 起動時のスプラッシュ画面
//
// 「開いた瞬間に出す」ことを最優先にしているため、
//  ・スタイルは全てインライン（TailwindのCSSファイルの読み込みを待たない）
//  ・ロゴはSVG直書き（画像ファイルの取得を待たない）
// としてある。HTMLが描画された時点で完成した状態で表示される。
// =============================================

// ちらつき防止の最低表示時間
const MIN_VISIBLE_MS = 400;
// データ取得が終わらない場合でも必ず消す上限
// （カレンダーAPIの応答が遅いこともあるため長めに取る）
const MAX_VISIBLE_MS = 8000;
// フェードアウトにかける時間
const FADE_MS = 300;

// JSが動かなかった場合の保険（CSSだけで必ず消えるようにする）
const FALLBACK_CSS = `
@keyframes splashAutoHide { to { opacity: 0; visibility: hidden; } }
#app-splash { animation: splashAutoHide 400ms ease 4000ms forwards; }
`;

// ブタの貯金箱（アイコンと同じ絵柄）
function PiggyLogo({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {/* 脚 */}
      <rect x="146" y="350" width="82" height="106" rx="36" fill="#E87BA6" />
      <rect x="284" y="350" width="82" height="106" rx="36" fill="#E87BA6" />
      {/* 耳 */}
      <path
        d="M142 178 L196 98 L246 172 Z"
        fill="#EF87AF"
        stroke="#EF87AF"
        strokeWidth="30"
        strokeLinejoin="round"
      />
      <path
        d="M370 178 L316 98 L266 172 Z"
        fill="#EF87AF"
        stroke="#EF87AF"
        strokeWidth="30"
        strokeLinejoin="round"
      />
      {/* 胴体 */}
      <ellipse cx="256" cy="268" rx="178" ry="150" fill="#F79FC0" />
      {/* コイン投入口 */}
      <rect x="198" y="142" width="116" height="22" rx="11" fill="#D45F8C" />
      {/* 目 */}
      <circle cx="198" cy="250" r="17" fill="#3D2A33" />
      <circle cx="314" cy="250" r="17" fill="#3D2A33" />
      {/* 鼻 */}
      <ellipse cx="256" cy="322" rx="66" ry="50" fill="#EF87AF" />
      <ellipse cx="234" cy="322" rx="11" ry="15" fill="#C94F7E" />
      <ellipse cx="278" cy="322" rx="11" ry="15" fill="#C94F7E" />
    </svg>
  );
}

export default function SplashScreen() {
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">("visible");

  useEffect(() => {
    const startedAt = Date.now();
    let started = false;
    const timers: number[] = [];

    // 読み込み完了を検知したらフェードアウトを開始する
    const startFade = () => {
      if (started) return;
      started = true;
      // 一瞬で消えてちらつかないよう、最低表示時間は確保する
      const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
      timers.push(
        window.setTimeout(() => {
          setPhase("fading");
          timers.push(window.setTimeout(() => setPhase("gone"), FADE_MS));
        }, wait)
      );
    };

    // ページの読み込みだけでなく、初期データの取得完了まで待つ。
    // これによりスプラッシュが消えた時点で中身が表示済みになる。
    const unsubscribe = onAppReady(startFade);
    // データ取得が終わらないケースの保険
    timers.push(window.setTimeout(startFade, MAX_VISIBLE_MS));

    return () => {
      unsubscribe();
      timers.forEach(clearTimeout);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: FALLBACK_CSS }} />
      <div
        id="app-splash"
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: phase === "fading" ? 0 : 1,
          transition: `opacity ${FADE_MS}ms ease`,
        }}
      >
        <PiggyLogo size={128} />
        <p
          style={{
            position: "absolute",
            bottom: "4rem",
            margin: 0,
            fontSize: "0.875rem",
            color: "#9ca3af",
            fontFamily:
              "system-ui, -apple-system, 'Hiragino Kaku Gothic ProN', sans-serif",
          }}
        >
          給与管理
        </p>
      </div>
    </>
  );
}
