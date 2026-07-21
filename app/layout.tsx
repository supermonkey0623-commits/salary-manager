import type { Metadata, Viewport } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import SessionMonitor from "@/components/SessionMonitor";

export const metadata: Metadata = {
  title: "給与管理",
  description: "個人給与管理Webアプリ",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "給与管理",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900" suppressHydrationWarning>
        <SessionProvider>
          {/* セッションエラー時に自動で再ログインする監視コンポーネント */}
          <SessionMonitor />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
