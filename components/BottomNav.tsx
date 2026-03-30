"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// ナビゲーションメニュー定義
const NAV_ITEMS = [
  { href: "/payslip", label: "給与明細", icon: "💴" },
  { href: "/chart", label: "収入グラフ", icon: "🥧" },
  { href: "/annual", label: "年間DB", icon: "📊" },
  { href: "/settings", label: "設定", icon: "⚙️" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
                isActive
                  ? "text-blue-600 font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
