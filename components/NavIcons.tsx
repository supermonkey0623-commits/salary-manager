// =============================================
// ボトムナビ用のピクトグラムアイコン
// 単色の線画（currentColorを継承）で統一する
// =============================================

type IconProps = {
  className?: string;
};

// 共通のSVGラッパー（線の太さ・端の形状を統一）
function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// 給与明細：明細書（枠＋記載行）
export function PayslipIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <line x1="8" y1="8.5" x2="16" y2="8.5" />
      <line x1="8" y1="12.5" x2="16" y2="12.5" />
      <line x1="8" y1="16.5" x2="12.5" y2="16.5" />
    </Svg>
  );
}

// 収入グラフ：円グラフ（円＋2本の半径）
export function ChartIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="12" x2="12" y2="3" />
      <line x1="12" y1="12" x2="21" y2="12" />
    </Svg>
  );
}

// 年間DB：表（枠＋罫線）
export function TableIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <line x1="3" y1="9.5" x2="21" y2="9.5" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="10" y1="9.5" x2="10" y2="20" />
    </Svg>
  );
}

// 家計簿：財布（本体＋折り返し線＋留め具）
export function WalletIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="6" width="18" height="14" rx="3" />
      <line x1="3" y1="10.5" x2="21" y2="10.5" />
      <circle cx="16.5" cy="15.5" r="1.4" />
    </Svg>
  );
}

// 空状態表示用：カレンダー（枠＋見出し罫＋留め具）
export function CalendarIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </Svg>
  );
}

// 設定：スライダー（つまみ付きの調整バー）
export function SettingsIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      {/* 1本目：つまみは左寄り */}
      <line x1="4" y1="21" x2="4" y2="15" />
      <line x1="4" y1="11" x2="4" y2="3" />
      <circle cx="4" cy="13" r="2" />
      {/* 2本目：つまみは中央より下 */}
      <line x1="12" y1="21" x2="12" y2="17" />
      <line x1="12" y1="13" x2="12" y2="3" />
      <circle cx="12" cy="15" r="2" />
      {/* 3本目：つまみは上寄り */}
      <line x1="20" y1="21" x2="20" y2="11" />
      <line x1="20" y1="7" x2="20" y2="3" />
      <circle cx="20" cy="9" r="2" />
    </Svg>
  );
}
