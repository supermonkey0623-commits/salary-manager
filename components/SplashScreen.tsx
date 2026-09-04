"use client";

import { useEffect, useState } from "react";

// =============================================
// 起動時のスプラッシュ画面
// アプリを開いてから読み込みが終わるまでの数秒を覆い隠す。
// ロゴはSVGを直接埋め込み、画像の読み込みを待たずに即描画されるようにする。
// =============================================

// ちらつき防止の最低表示時間
const MIN_VISIBLE_MS = 450;
// 読み込みが終わらない場合でも必ず消す上限
const MAX_VISIBLE_MS = 3000;
// フェードアウトにかける時間（globals.css の duration と揃える）
const FADE_MS = 320;

// ブタの貯金箱（アイコンと同じ絵柄）
function PiggyLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
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

    if (document.readyState === "complete") {
      startFade();
    } else {
      window.addEventListener("load", startFade, { once: true });
    }
    // 読み込みが終わらないケースの保険
    timers.push(window.setTimeout(startFade, MAX_VISIBLE_MS));

    return () => {
      window.removeEventListener("load", startFade);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      className={`splash-screen fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center transition-opacity duration-300 ${
        phase === "fading" ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <PiggyLogo className="w-32 h-32" />
      <p className="absolute bottom-16 text-sm text-gray-400">給与管理</p>
    </div>
  );
}
