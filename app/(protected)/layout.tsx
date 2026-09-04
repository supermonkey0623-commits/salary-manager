import BottomNav from "@/components/BottomNav";
import PageTransition from "@/components/PageTransition";

// 認証済みユーザー向けの共通レイアウト（ボトムナビ付き）
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen pb-20 overflow-x-hidden">
      <main className="max-w-lg mx-auto">
        {/* タブ移動時に左右へスライドさせる */}
        <PageTransition>{children}</PageTransition>
      </main>
      <BottomNav />
    </div>
  );
}
