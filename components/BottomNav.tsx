"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PayslipIcon,
  ChartIcon,
  TableIcon,
  SettingsIcon,
} from "@/components/NavIcons";

// ナビゲーションメニュー定義（アイコンはピクトグラム）
const NAV_ITEMS = [
  { href: "/payslip", label: "給与明細", Icon: PayslipIcon },
  { href: "/chart", label: "収入グラフ", Icon: ChartIcon },
  { href: "/annual", label: "年間DB", Icon: TableIcon },
  { href: "/settings", label: "設定", Icon: SettingsIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className="flex-1 flex flex-col items-center justify-center pt-1.5 pb-1 gap-0.5 btn-press"
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
