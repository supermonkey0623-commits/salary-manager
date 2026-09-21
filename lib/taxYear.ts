// =============================================
// 確定申告（暦年）ベースの集計期間
//
// 年間DBは「働いた月」で記録する。給与は働いた月の翌月に支給されるため、
// 暦年Yに支給された分は「前年12月〜当年11月に働いた分」にあたる。
// 確定申告は支給日ベースで数えるので、年間合計もこの範囲で集計する。
//
//   働いた月 2025-12 → 2026-01 支給 → 2026年分
//   働いた月 2026-11 → 2026-12 支給 → 2026年分
//   働いた月 2026-12 → 2027-01 支給 → 2027年分
// =============================================

/** 年Yの集計対象となる年月（働いた月）を古い順に12件返す */
export function taxYearMonths(year: number): string[] {
  const months = [`${year - 1}-12`];
  for (let m = 1; m <= 11; m += 1) {
    months.push(`${year}-${String(m).padStart(2, "0")}`);
  }
  return months;
}

/** 年Yの集計対象範囲（DBの範囲検索用） */
export function taxYearRange(year: number): { from: string; to: string } {
  return { from: `${year - 1}-12`, to: `${year}-11` };
}

/** 働いた月 "2026-08" → 支給月 "2026-09" */
export function payoutMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  // Date の月は0始まりなので、m をそのまま渡すと「翌月」になる
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** その働いた月が属する確定申告年（＝支給された暦年） */
export function taxYearOf(yearMonth: string): number {
  return Number(payoutMonth(yearMonth).slice(0, 4));
}
