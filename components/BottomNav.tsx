"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PayslipIcon,
  ChartIcon,
  TableIcon,
  WalletIcon,
  SettingsIcon,
} from "@/components/NavIcons";
import { useParallaxNavigate } from "@/lib/navigation";

// ナビゲーションメニュー定義（アイコンはピクトグラム）
const NAV_ITEMS = [
  { href: "/payslip", label: "給与明細", Icon: PayslipIcon },
  { href: "/chart", label: "収入グラフ", Icon: ChartIcon },
  { href: "/annual", label: "年間DB", Icon: TableIcon },
  { href: "/expenses", label: "家計簿", Icon: WalletIcon },
  { href: "/settings", label: "設定", Icon: SettingsIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const navigate = useParallaxNavigate();

  return (
    <nav className="bottom-nav fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-[calc(env(safe-area-inset-bottom)+20px)]">
      <div className="flex max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              onClick={(e) => {
                // 修飾キー付きのクリック（新しいタブで開く等）はブラウザに任せる
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                navigate(href);
              }}
              className="flex-1 flex flex-col items-center justify-center pt-2 pb-0.5 gap-0.5 btn-press"
            >
              {/* アイコン：選択中は淡い青の座布団を敷く */}
              <span
                className={`flex items-center justify-center w-11 h-8 rounded-xl transition-colors ${
                  isActive ? "bg-blue-50 text-blue-600" : "text-gray-400"
                }`}
              >
                <Icon className="w-6 h-6" />
              </span>
              <span
                className={`text-[11px] transition-colors ${
                  isActive ? "text-blue-600 font-bold" : "text-gray-500"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
