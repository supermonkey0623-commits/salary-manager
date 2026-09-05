import type { ExpenseBreakdownLine } from "@/types/database";

// =============================================
// 家計簿の定数と集計ヘルパー
//
// カテゴリ・支払方法はDBテーブルにせずコード内の定数として持つ。
// 画面表示のたびに取得の往復が増えるのを避けるため（軽量・高速の方針）。
// 編集が必要になった時点でDB化する。
// =============================================

// カテゴリ（実データの利用頻度が高い順に並べ、入力時のタップ数を減らす）
export const EXPENSE_CATEGORIES = [
  "交際費",
  "交通費",
  "お菓子",
  "その他",
  "まかない",
  "娯楽費",
  "日用消耗品",
  "固定費",
  "食費",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// 支払方法
export const PAYMENT_METHODS = ["クレジットカード", "現金", "PiTaPa"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// カテゴリの表示色（バーやチップに使用。Notionの配色を踏襲）
export const CATEGORY_COLORS: Record<string, string> = {
  交際費: "#F97316",     // orange
  交通費: "#6B7280",     // gray
  お菓子: "#A855F7",     // purple
  その他: "#94A3B8",     // slate
  まかない: "#EC4899",   // pink
  娯楽費: "#3B82F6",     // blue
  日用消耗品: "#EAB308", // yellow
  固定費: "#EF4444",     // red
  食費: "#10B981",       // green
};

// 未知のカテゴリでも色が引けるようにする
export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#94A3B8";
}

// 金額フォーマット（1円未満切り捨て）
export function yen(n: number): string {
  return `¥${Math.floor(n).toLocaleString()}`;
}

// 指定月の初日・末日を YYYY-MM-DD で返す（DBの範囲検索用）
export function monthRange(yearMonth: string): { from: string; to: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const last = new Date(y, m, 0).getDate(); // 翌月0日＝当月末日
  return {
    from: `${yearMonth}-01`,
    to: `${yearMonth}-${String(last).padStart(2, "0")}`,
  };
}

// =============================================
// 内訳（メモ欄）のヘルパー
// =============================================

// 受け取った内訳を保存できる形に整える。
// タイトルも金額も空の行は捨て、1行も残らなければ null を返す
export function normalizeBreakdown(raw: unknown): ExpenseBreakdownLine[] | null {
  if (!Array.isArray(raw)) return null;
  const lines = raw
    .map((l) => {
      const o = (l ?? {}) as { title?: unknown; amount?: unknown };
      return {
        title: String(o.title ?? "").trim(),
        amount: Math.floor(Number(o.amount) || 0),
      };
    })
    .filter((l) => l.title !== "" || l.amount > 0);
  return lines.length > 0 ? lines : null;
}

// 内訳の合計
export function breakdownTotal(
  lines: ExpenseBreakdownLine[] | null | undefined
): number {
  return (lines ?? []).reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
}
