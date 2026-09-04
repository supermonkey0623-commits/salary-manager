"use client";

import { useEffect, useState, useCallback } from "react";
import type { SalaryBreakdown, WorkBreakdown } from "@/lib/salary";

// 月を YYYY-MM 形式にフォーマット
function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// YYYY-MM を「YYYY年M月」に変換
function formatYearMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}年${Number(m)}月`;
}

// 金額フォーマット（¥1,234）
function yen(n: number): string {
  return `¥${n.toLocaleString()}`;
}

// 時間フォーマット（小数点2桁）
function hours(h: number): string {
  return `${h.toFixed(2)}h`;
}

// YYYY-MM-DD を「M/D」に変換
function shortDate(d: string): string {
  const [, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}`;
}

// =============================================
// アコーディオン詳細パネル
// =============================================
type DetailType = "normal" | "overtime" | "nightNormal" | "nightOvertime" | "transport";

function DetailPanel({
  type,
  events,
  rate,
  nightRate,
  transportFee,
}: {
  type: DetailType;
  events: WorkBreakdown[];
  rate: number;
  nightRate: number;
  transportFee: number;
}) {
  // 対象イベントを種別でフィルタリング
  const relevant = events.filter((e) => {
    if (type === "normal") return e.normalHours > 0;
    if (type === "overtime") return e.overtimeHours > 0;
    if (type === "nightNormal") return e.nightNormalHours > 0;
    if (type === "nightOvertime") return e.nightOvertimeHours > 0;
    if (type === "transport") return true;
    return false;
  });

  if (type === "transport") {
    // 交通費：勤務日一覧
    const days = [...new Set(events.map((e) => e.date))].sort();
    return (
      <div className="bg-gray-50 rounded-lg p-3 mt-1 text-xs text-gray-600 space-y-1">
        <p className="font-medium text-gray-700 mb-2">勤務日内訳</p>
        {days.map((d) => (
          <div key={d} className="flex justify-between">
            <span>{shortDate(d)}</span>
            <span>{yen(transportFee)}</span>
          </div>
        ))}
        <div className="border-t border-gray-200 pt-1 flex justify-between font-medium">
          <span>合計 {days.length}日</span>
          <span>{yen(transportFee * days.length)}</span>
        </div>
      </div>
    );
  }

  if (relevant.length === 0) return null;

  // 単価の表示
  const unitRate = type === "normal" ? rate : Math.floor(rate * nightRate);
  const getTargetHours = (e: WorkBreakdown) => {
    if (type === "normal") return e.normalHours;
    if (type === "overtime") return e.overtimeHours;
    if (type === "nightNormal") return e.nightNormalHours;
    if (type === "nightOvertime") return e.nightOvertimeHours;
    return 0;
  };

  return (
    <div className="bg-gray-50 rounded-lg p-3 mt-1 text-xs text-gray-600 space-y-2">
      <p className="font-medium text-gray-700">勤務日内訳</p>
      {relevant.map((e) => {
        const h = getTargetHours(e);
        const pay = Math.floor(unitRate * h);
        return (
          <div key={`${e.date}-${e.startTime}`} className="space-y-0.5">
            <div className="flex justify-between">
              <span className="font-medium text-gray-700">
                {shortDate(e.date)}　{e.startTime}〜{e.endTime}
                {e.breakMinutes > 0 && (
                  <span className="text-gray-400 ml-1">（休憩{e.breakMinutes}分）</span>
                )}
              </span>
              <span>{yen(pay)}</span>
            </div>
            {/* イベントタイトルを表示（誤マッチ確認用） */}
            <p className="text-blue-400 text-xs">「{e.eventTitle}」</p>
            <p className="text-gray-400">
              {yen(unitRate)} × {hours(h)} = {yen(pay)}
            </p>
          </div>
        );
      })}
      <div className="border-t border-gray-200 pt-1 flex justify-between font-medium text-gray-700">
        <span>合計 {hours(relevant.reduce((s, e) => s + getTargetHours(e), 0))}</span>
        <span>{yen(relevant.reduce((s, e) => s + Math.floor(unitRate * getTargetHours(e)), 0))}</span>
      </div>
    </div>
  );
}

// =============================================
// 明細1行（アコーディオン付き）
// =============================================
function PayRow({
  label,
  rate,
  time,
  amount,
  badge,
  isDeduction,
  detailType,
  events,
  hourlyRate,
  nightRate,
  transportFee,
}: {
  label: string;
  rate?: string;
  time?: string;
  amount: number;
  badge?: string;
  isDeduction?: boolean;
  detailType?: DetailType;
  events?: WorkBreakdown[];
  hourlyRate?: number;
  nightRate?: number;
  transportFee?: number;
}) {
  const [open, setOpen] = useState(false);

  // 詳細ボタンを表示するか（金額>0 かつ詳細情報あり）
  const hasDetail = detailType && events && events.length > 0 &&
    (amount > 0 || detailType === "transport");

  if (amount === 0 && !isDeduction && detailType !== "transport") {
    return (
      <div className="flex justify-between items-center py-2.5 border-b border-gray-100">
        <span className="text-sm text-gray-700">{label}</span>
        <span className="text-sm text-gray-400">なし</span>
      </div>
    );
  }

  return (
    <div className="border-b border-gray-100">
      <div className="flex justify-between items-start py-2.5">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-800">{label}</span>
            {badge && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                {badge}
              </span>
            )}
            {/* アコーディオン詳細ボタン */}
            {hasDetail && (
              <button
                onClick={() => setOpen((v) => !v)}
                className="btn3d btn3d-sm btn-soft-blue text-xs px-2.5 py-1"
              >
                {open ? "▲ 閉じる" : "▼ 詳細"}
              </button>
            )}
          </div>
          {rate && time && (
            <p className="text-xs text-gray-400 mt-0.5">
              {rate} × {time}
            </p>
          )}
        </div>
        <span className={`text-sm font-medium ${isDeduction ? "text-red-500" : "text-gray-900"}`}>
          {isDeduction ? `−${yen(amount)}` : yen(amount)}
        </span>
      </div>

      {/* アコーディオン展開パネル */}
      {open && hasDetail && events && hourlyRate !== undefined && nightRate !== undefined && transportFee !== undefined && (
        <div className="pb-2">
          <DetailPanel
            type={detailType!}
            events={events}
            rate={hourlyRate}
            nightRate={nightRate}
            transportFee={transportFee}
          />
        </div>
      )}
    </div>
  );
}

// =============================================
// 収入源1件分の給与明細カード
// =============================================
function SalaryCard({ salary }: { salary: SalaryBreakdown }) {
  const s = salary.source;
  const rate = s.hourly_rate;
  const nightRate = Number(s.night_rate);

  // 合計時間
  const totalNormal = salary.events.reduce((sum, e) => sum + e.normalHours, 0);
  const totalOvertime = salary.events.reduce((sum, e) => sum + e.overtimeHours, 0);
  const totalNightNormal = salary.events.reduce((sum, e) => sum + e.nightNormalHours, 0);
  const totalNightOvertime = salary.events.reduce((sum, e) => sum + e.nightOvertimeHours, 0);

  // PayRow共通propsのショートカット
  const detailProps = {
    events: salary.events,
    hourlyRate: rate,
    nightRate,
    transportFee: s.transport_fee,
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800">{s.name}</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          勤務 {salary.workDays}日 / キーワード：{s.keyword}
          {s.default_break_minutes > 0 && `　/ デフォルト休憩 ${s.default_break_minutes}分`}
        </p>
      </div>

      {salary.events.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">
          該当する予定がありません
        </div>
      ) : (
        <div className="px-4">
          <PayRow
            label="基本給料"
            rate={yen(rate)}
            time={hours(totalNormal)}
            amount={salary.normalPay}
            detailType="normal"
            {...detailProps}
          />
          <PayRow
            label="残業手当"
            rate={yen(Math.floor(rate * nightRate))}
            time={hours(totalOvertime)}
            amount={salary.overtimePay}
            badge="25%"
            detailType="overtime"
            {...detailProps}
          />
          <PayRow
            label="深夜給料"
            rate={yen(Math.floor(rate * nightRate))}
            time={hours(totalNightNormal)}
            amount={salary.nightNormalPay}
            detailType="nightNormal"
            {...detailProps}
          />
          <PayRow
            label="深夜残業手当"
            rate={yen(Math.floor(rate * nightRate))}
            time={hours(totalNightOvertime)}
            amount={salary.nightOvertimePay}
            badge="25%"
            detailType="nightOvertime"
            {...detailProps}
          />
          <PayRow
            label="交通費"
            rate="¥500"
            time={`${salary.workDays}日`}
            amount={salary.transportFee}
            detailType="transport"
            {...detailProps}
          />
          {s.extra_allowance ? (
            <PayRow label="その他手当" amount={salary.extraAllowance} />
          ) : null}
          {s.deduction ? (
            <PayRow label="天引" amount={salary.deduction} isDeduction />
          ) : null}
          {s.memo ? (
            <div className="py-2.5 border-b border-gray-100">
              <span className="text-xs text-gray-400">個別設定：{s.memo}</span>
            </div>
          ) : null}

          {/* 合計 */}
          <div className="flex justify-between items-center py-3">
            <span className="font-semibold text-gray-800">合計</span>
            <span className="text-xl font-bold text-blue-600">
              {yen(salary.total)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================
// メインページ
// =============================================
export default function PayslipPage() {
  const now = new Date();
  const [yearMonth, setYearMonth] = useState(toYearMonth(now));
  const [salaries, setSalaries] = useState<SalaryBreakdown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState(0);

  const fetchSalaries = useCallback(async (ym: string) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/calendar?month=${ym}`);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          // セッション切れ → ログインページへ（自動で再ログインされる）
          window.location.href = "/login?error=SessionExpired&callbackUrl=/payslip";
          return;
        }
        setError(data.error ?? "データの取得に失敗しました");
        return;
      }

      setSalaries(data.salaries ?? []);
      setMessage(data.message ?? "");
      setActiveTab(0);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSalaries(yearMonth);
  }, [yearMonth, fetchSalaries]);

  // 前月・翌月に移動
  const moveMonth = (delta: number) => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setYearMonth(toYearMonth(d));
  };

  // 有効な給与データのみ
  const activeSalaries = salaries.filter((s) => s.source.is_active !== false);

  return (
    <div className="p-4">
      {/* ヘッダー */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
          給料見込みの内訳
        </p>
        <div className="flex items-center justify-between">
          <button
            onClick={() => moveMonth(-1)}
            className="btn-press w-10 h-10 flex items-center justify-center text-xl text-gray-500 hover:bg-gray-100 rounded-xl"
            aria-label="前の月"
          >
            ‹
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {formatYearMonth(yearMonth)}
          </h1>
          <button
            onClick={() => moveMonth(1)}
            className="btn-press w-10 h-10 flex items-center justify-center text-xl text-gray-500 hover:bg-gray-100 rounded-xl"
            aria-label="次の月"
          >
            ›
          </button>
        </div>
      </div>

      {/* 収入源タブ */}
      {activeSalaries.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {activeSalaries.map((s, i) => (
            <button
              key={s.source.id}
              onClick={() => setActiveTab(i)}
              className={`btn3d btn3d-sm shrink-0 px-4 py-1.5 text-sm ${
                activeTab === i ? "btn-primary" : "btn-soft-gray"
              }`}
            >
              {s.source.name}
            </button>
          ))}
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="text-center py-12 text-gray-400 text-sm">
          読み込み中...
        </div>
      )}

      {/* エラー */}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 予定なしメッセージ */}
      {!loading && !error && message && activeSalaries.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 mb-4">
          {message}
        </div>
      )}

      {/* 収入源未登録 */}
      {!loading && !error && salaries.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm mb-2">収入源が登録されていません</p>
          <a href="/settings" className="text-blue-600 text-sm font-medium">
            設定から収入源を追加する →
          </a>
        </div>
      )}

      {/* 給与明細カード */}
      {!loading && !error && activeSalaries.length > 0 && (
        <>
          <SalaryCard salary={activeSalaries[activeTab]} />

          {/* 月合計（複数収入源の場合） */}
          {activeSalaries.length > 1 && (
            <div className="bg-blue-50 rounded-2xl border border-blue-100 px-4 py-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-blue-800">月合計</span>
                <span className="text-lg font-bold text-blue-700">
                  {yen(activeSalaries.reduce((s, sal) => s + sal.total, 0))}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* 注記 */}
      {!loading && activeSalaries.length > 0 && (
        <p className="text-xs text-gray-400 text-center mt-2 leading-relaxed px-2">
          給料見込みは税金・保険料が差し引かれる前の金額です。
          各項目1円未満を切り捨てた金額を表示しています。
        </p>
      )}
    </div>
  );
}
