import type { Metadata, Viewport } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import SessionMonitor from "@/components/SessionMonitor";
import SplashScreen from "@/components/SplashScreen";

// iOSのホーム画面から起動したときに表示される起動画面
// 端末ごとに解像度が一致する画像でないと使われないため、主要機種分を列挙する
const APPLE_SPLASH = [
  { w: 440, h: 956, px: 3, file: "1320-2868" }, // iPhone 16 Pro Max
  { w: 402, h: 874, px: 3, file: "1206-2622" }, // iPhone 16 Pro
  { w: 430, h: 932, px: 3, file: "1290-2796" }, // iPhone 15/14 Pro Max
  { w: 393, h: 852, px: 3, file: "1179-2556" }, // iPhone 15/14 Pro
  { w: 428, h: 926, px: 3, file: "1284-2778" }, // iPhone 13/12 Pro Max
  { w: 390, h: 844, px: 3, file: "1170-2532" }, // iPhone 13/12
  { w: 414, h: 896, px: 3, file: "1242-2688" }, // iPhone 11 Pro Max / XS Max
  { w: 414, h: 896, px: 2, file: "828-1792" },  // iPhone 11 / XR
  { w: 375, h: 812, px: 3, file: "1125-2436" }, // iPhone X / XS / 11 Pro
  { w: 414, h: 736, px: 3, file: "1242-2208" }, // iPhone 8 Plus
  { w: 375, h: 667, px: 2, file: "750-1334" },  // iPhone SE / 8
];

export const metadata: Metadata = {
  title: "給与管理",
  description: "個人給与管理Webアプリ",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "給与管理",
    startupImage: APPLE_SPLASH.map(({ w, h, px, file }) => ({
      url: `/splash/splash-${file}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${px}) and (orientation: portrait)`,
    })),
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
        {/* 読み込み中を覆い隠す起動画面（準備ができ次第フェードアウトする） */}
        <SplashScreen />
        <SessionProvider>
          {/* セッションエラー時に自動で再ログインする監視コンポーネント */}
          <SessionMonitor />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
