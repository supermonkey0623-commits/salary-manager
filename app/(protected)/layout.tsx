import BottomNav from "@/components/BottomNav";

// 認証済みユーザー向けの共通レイアウト（ボトムナビ付き）
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen pb-16">
      <main className="max-w-lg mx-auto">{children}</main>
      <BottomNav />
    </div>
  );
}
