// =============================================
// サブスクの日付計算
// 更新日は「毎月N日」で保持しているため、当月の日数に合わせて丸める
// （例：31日更新のサブスクは、2月なら28日/29日を更新日として扱う）
// =============================================

// その月の末日
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// 指定年月における実際の更新日（月末を超えないよう丸める）
function renewalDateIn(year: number, month: number, renewalDay: number): Date {
  const day = Math.min(renewalDay, lastDayOfMonth(year, month));
  return new Date(year, month, day);
}

// 次回の更新日を返す（本日を含む。今日が更新日なら今日）
export function nextRenewalDate(renewalDay: number, today = new Date()): Date {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const thisMonth = renewalDateIn(base.getFullYear(), base.getMonth(), renewalDay);
  if (thisMonth >= base) return thisMonth;
  return renewalDateIn(base.getFullYear(), base.getMonth() + 1, renewalDay);
}

// 次回更新日までの日数（今日なら0）
export function daysUntilRenewal(renewalDay: number, today = new Date()): number {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const next = nextRenewalDate(renewalDay, base);
  return Math.round((next.getTime() - base.getTime()) / 86400000);
}

// 「9/24（あと3日）」のような表示用の文字列
export function formatRenewal(renewalDay: number, today = new Date()): string {
  const next = nextRenewalDate(renewalDay, today);
  const days = daysUntilRenewal(renewalDay, today);
  const label = days === 0 ? "今日" : `あと${days}日`;
  return `${next.getMonth() + 1}/${next.getDate()}（${label}）`;
}
