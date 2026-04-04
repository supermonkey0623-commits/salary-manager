import type { IncomeSource } from "@/types/database";

// 深夜時間帯の定義（22:00〜翌5:00）
const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 5;

// 法定労働時間（1日）
const LEGAL_DAILY_HOURS = 8;

// カレンダーイベント1件の型
export type CalendarEvent = {
  id: string;
  summary: string;        // 予定タイトル
  start: string;          // ISO8601
  end: string;            // ISO8601
  date?: string;          // 終日イベントの日付
  description?: string;   // 予定の説明欄（休憩時間の記載に使用）
};

// 勤務時間の内訳（時間単位）
export type WorkBreakdown = {
  date: string;           // 勤務日（YYYY-MM-DD）
  eventTitle: string;
  startTime: string;      // HH:MM
  endTime: string;        // HH:MM
  totalHours: number;     // 勤務時間合計（休憩差し引き前）
  breakMinutes: number;   // 差し引いた休憩時間（分）
  workedHours: number;    // 実労働時間（休憩差し引き後）
  normalHours: number;    // 通常勤務時間（法定内）
  overtimeHours: number;  // 残業時間（法定超）
  nightNormalHours: number;   // 深夜通常時間
  nightOvertimeHours: number; // 深夜残業時間
};

// 給与計算結果
export type SalaryBreakdown = {
  source: IncomeSource;
  events: WorkBreakdown[];
  workDays: number;       // 勤務日数
  // 各金額（1円未満切り捨て済み）
  normalPay: number;          // 基本給料
  overtimePay: number;        // 残業手当（25%）
  nightNormalPay: number;     // 深夜給料
  nightOvertimePay: number;   // 深夜残業手当
  transportFee: number;       // 交通費
  extraAllowance: number;     // その他手当
  deduction: number;          // 天引
  total: number;              // 合計
};

// =============================================
// 休憩時間のパース
// =============================================

// 説明欄から休憩時間（分）を抽出する
// 対応形式: 「休憩1時間」「休憩30分」「休憩1.5時間」「休憩1時間30分」
export function parseBreakMinutes(description: string | undefined): number | null {
  if (!description) return null;

  // 「休憩X時間Y分」（時間・分の複合形式）
  const complexMatch = description.match(/休憩\s*(\d+(?:\.\d+)?)\s*時間\s*(\d+)\s*分/);
  if (complexMatch) {
    return Math.round(Number(complexMatch[1]) * 60 + Number(complexMatch[2]));
  }

  // 「休憩X時間」（時間のみ）
  const hourMatch = description.match(/休憩\s*(\d+(?:\.\d+)?)\s*時間/);
  if (hourMatch) {
    return Math.round(Number(hourMatch[1]) * 60);
  }

  // 「休憩X分」（分のみ）
  const minMatch = description.match(/休憩\s*(\d+)\s*分/);
  if (minMatch) {
    return Number(minMatch[1]);
  }

  return null;
}

// =============================================
// 深夜時間と通常時間の分離
// =============================================

// 日時文字列からDateオブジェクトを生成
function parseDate(iso: string): Date {
  return new Date(iso);
}

// DateをN日ずらす（UTCベースで安全に計算）
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 3600 * 1000);
}

// 指定した日のJST HH:MMに対応するDateを生成する（UTC+9補正済み）
// Vercel等のUTCサーバーでも正しくJST時刻を扱うために必要
function dateAtHour(base: Date, jstHour: number, minute = 0): Date {
  // base の JST 日付（年月日）を求める
  const jstMs = base.getTime() + 9 * 3600 * 1000;
  const jstBase = new Date(jstMs);
  const y = jstBase.getUTCFullYear();
  const m = jstBase.getUTCMonth();
  const d = jstBase.getUTCDate();
  // JST時刻をUTCに変換（UTC = JST - 9時間）
  // jstHour - 9 が負になる場合はDate.UTCが前日に補正してくれる
  return new Date(Date.UTC(y, m, d, jstHour - 9, minute));
}

// 2つの時間範囲の重複時間（時間単位）を計算
function overlapHours(
  start1: Date, end1: Date,
  start2: Date, end2: Date
): number {
  const overlapStart = start1 > start2 ? start1 : start2;
  const overlapEnd = end1 < end2 ? end1 : end2;
  const ms = overlapEnd.getTime() - overlapStart.getTime();
  return ms > 0 ? ms / 3600000 : 0;
}

// 勤務時間帯のうち深夜時間（22:00〜翌5:00）を計算
function calcNightHours(start: Date, end: Date): number {
  // 22:00〜翌5:00の深夜区間を構築（最大2区間）
  const nightSegments: Array<[Date, Date]> = [];

  // 当日（JST）の22:00〜翌日（JST）5:00
  const night1Start = dateAtHour(start, NIGHT_START_HOUR);
  const night1End = dateAtHour(addDays(start, 1), NIGHT_END_HOUR);
  nightSegments.push([night1Start, night1End]);

  // 前日（JST）の22:00〜当日（JST）5:00（夜をまたぐシフト対応）
  const night2End = dateAtHour(start, NIGHT_END_HOUR);
  const night2Start = dateAtHour(addDays(start, -1), NIGHT_START_HOUR);
  nightSegments.push([night2Start, night2End]);

  return nightSegments.reduce(
    (sum, [ns, ne]) => sum + overlapHours(start, end, ns, ne),
    0
  );
}

// =============================================
// イベント1件の勤務時間内訳を計算
// =============================================
export function calcWorkBreakdown(
  event: CalendarEvent,
  defaultBreakMinutes: number
): WorkBreakdown | null {
  // 終日イベントはスキップ
  if (!event.start || event.start.length === 10) return null;

  const start = parseDate(event.start);
  const end = parseDate(event.end);
  const totalHours = (end.getTime() - start.getTime()) / 3600000;

  if (totalHours <= 0) return null;

  // 説明欄から休憩時間を取得。記載なければデフォルト値を使用
  const parsedBreak = parseBreakMinutes(event.description);
  const breakMinutes = parsedBreak !== null ? parsedBreak : defaultBreakMinutes;

  // 実労働時間（休憩を差し引く）
  const workedHours = Math.max(0, totalHours - breakMinutes / 60);

  // 深夜時間（実労働時間に対して比例配分）
  const rawNightHours = calcNightHours(start, end);
  const nightRatio = totalHours > 0 ? rawNightHours / totalHours : 0;
  const nightHours = workedHours * nightRatio;

  // 通常時間（深夜以外）
  const dayHours = workedHours - nightHours;

  // 法定労働時間との比較で残業を分離
  const normalHours = Math.min(dayHours, Math.max(0, LEGAL_DAILY_HOURS - nightHours));
  const overtimeHours = Math.max(0, dayHours - normalHours);

  // 深夜も法定内/残業に分離
  const nightNormalHours = Math.min(nightHours, Math.max(0, LEGAL_DAILY_HOURS - dayHours));
  const nightOvertimeHours = Math.max(0, nightHours - nightNormalHours);

  // JST時刻で表示する（サーバーのローカルタイムに依存しないようUTC+9で計算）
  const toJst = (d: Date) => new Date(d.getTime() + 9 * 3600 * 1000);
  const fmt = (d: Date) => {
    const j = toJst(d);
    return `${String(j.getUTCHours()).padStart(2, "0")}:${String(j.getUTCMinutes()).padStart(2, "0")}`;
  };

  // 勤務日はJST基準の日付を使う
  const jstStart = toJst(start);
  return {
    date: jstStart.toISOString().slice(0, 10),
    eventTitle: event.summary,
    startTime: fmt(start),
    endTime: fmt(end),
    totalHours,
    breakMinutes,
    workedHours,
    normalHours,
    overtimeHours,
    nightNormalHours,
    nightOvertimeHours,
  };
}

// =============================================
// 収入源1件分の給与計算
// =============================================
export function calcSalary(
  source: IncomeSource,
  events: CalendarEvent[]
): SalaryBreakdown {
  const rate = source.hourly_rate;
  const nightRate = Number(source.night_rate); // 例: 1.25
  const defaultBreakMinutes = source.default_break_minutes ?? 0;

  // 勤務日ごとにグループ化（交通費計算用）
  const workDaySet = new Set<string>();
  const breakdowns: WorkBreakdown[] = [];

  for (const ev of events) {
    const bd = calcWorkBreakdown(ev, defaultBreakMinutes);
    if (!bd) continue;
    breakdowns.push(bd);
    workDaySet.add(bd.date);
  }

  const workDays = workDaySet.size;

  // 各時間の合計
  const totalNormal = breakdowns.reduce((s, b) => s + b.normalHours, 0);
  const totalOvertime = breakdowns.reduce((s, b) => s + b.overtimeHours, 0);
  const totalNightNormal = breakdowns.reduce((s, b) => s + b.nightNormalHours, 0);
  const totalNightOvertime = breakdowns.reduce((s, b) => s + b.nightOvertimeHours, 0);

  // 金額計算（1円未満切り捨て）
  const normalPay = Math.floor(rate * totalNormal);
  const overtimePay = Math.floor(rate * nightRate * totalOvertime);
  const nightNormalPay = Math.floor(rate * nightRate * totalNightNormal);
  const nightOvertimePay = Math.floor(rate * nightRate * totalNightOvertime);
  const transportFee = source.transport_fee * workDays;
  const extraAllowance = source.extra_allowance ?? 0;
  const deduction = source.deduction ?? 0;

  const total =
    normalPay +
    overtimePay +
    nightNormalPay +
    nightOvertimePay +
    transportFee +
    extraAllowance -
    deduction;

  return {
    source,
    events: breakdowns,
    workDays,
    normalPay,
    overtimePay,
    nightNormalPay,
    nightOvertimePay,
    transportFee,
    extraAllowance,
    deduction,
    total,
  };
}
