import BottomNav from "@/components/BottomNav";
import SwipeParallax from "@/components/SwipeParallax";

// 認証済みユーザー向けの共通レイアウト（ボトムナビ付き）
// 画面遷移のアニメーションは template.tsx が担当する
// （layout は遷移で再マウントされないため、template を使う必要がある）
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen pb-32 overflow-x-hidden">
      <main className="max-w-lg mx-auto">
        {/* 横スワイプで指に追従させ、離すと隣のタブへ移動する */}
        <SwipeParallax>{children}</SwipeParallax>
      </main>
      <BottomNav />
    </div>
  );
}
