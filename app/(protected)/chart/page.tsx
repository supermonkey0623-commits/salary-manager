"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Sector,
} from "recharts";
import type { SalaryBreakdown } from "@/lib/salary";
import { CalendarIcon } from "@/components/NavIcons";
import { markAppReady } from "@/lib/appReady";

// =============================================
// ユーティリティ
// =============================================

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

// 収入源ごとのカラーパレット
const COLORS = [
  "#3B82F6", // blue-500
  "#F59E0B", // amber-500
  "#10B981", // emerald-500
  "#EF4444", // red-500
  "#8B5CF6", // violet-500
  "#F97316", // orange-500
  "#06B6D4", // cyan-500
  "#EC4899", // pink-500
];

// =============================================
// アクティブなセクターの描画（タップ時に拡大）
// =============================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderActiveShape(props: any) {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent,
  } = props;

  return (
    <g>
      {/* 中央テキスト */}
      <text x={cx} y={cy - 12} textAnchor="middle" fill="#1F2937" className="text-sm font-semibold" fontSize={13} fontWeight={600}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#3B82F6" fontSize={16} fontWeight={700}>
        {yen(payload.value)}
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle" fill="#6B7280" fontSize={12}>
        {(percent * 100).toFixed(1)}%
      </text>

      {/* 拡大したセクター */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      {/* 外側のリング */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 12}
        outerRadius={outerRadius + 16}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
}

// =============================================
// 収入源1件の詳細内訳パネル
// =============================================
function DetailPanel({
  salary,
  color,
}: {
  salary: SalaryBreakdown;
  color: string;
}) {
  const s = salary.source;
  const rows: { label: string; amount: number }[] = [
    { label: "基本給料", amount: salary.normalPay },
    { label: "残業手当", amount: salary.overtimePay },
    { label: "深夜給料", amount: salary.nightNormalPay },
    { label: "深夜残業手当", amount: salary.nightOvertimePay },
    { label: "交通費", amount: salary.transportFee },
    { label: "その他手当", amount: salary.extraAllowance },
  ].filter((r) => r.amount > 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* ヘッダー */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ backgroundColor: `${color}15` }}
      >
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <div>
          <p className="font-semibold text-gray-800 text-sm">{s.name}</p>
          <p className="text-xs text-gray-500">
            勤務 {salary.workDays}日 / {salary.events.length}件
          </p>
        </div>
        <span className="ml-auto text-base font-bold" style={{ color }}>
          {yen(salary.total)}
        </span>
      </div>

      {/* 内訳 */}
      <div className="px-4 py-2 divide-y divide-gray-50">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-600">{r.label}</span>
            <span className="text-gray-800 font-medium">{yen(r.amount)}</span>
          </div>
        ))}
        {salary.deduction > 0 && (
          <div className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-600">天引</span>
            <span className="text-red-500 font-medium">−{yen(salary.deduction)}</span>
          </div>
        )}
      </div>

      {/* 勤務日一覧 */}
      {salary.events.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-400 mb-1.5">勤務予定日</p>
          <div className="flex flex-wrap gap-1.5">
            {[...new Set(salary.events.map((e) => e.date))].sort().map((d) => {
              const [, m, day] = d.split("-");
              return (
                <span
                  key={d}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {Number(m)}/{Number(day)}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================
// メインページ
// =============================================
export default function ChartPage() {
  const now = new Date();
  const [yearMonth, setYearMonth] = useState(toYearMonth(now));
  const [salaries, setSalaries] = useState<SalaryBreakdown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const fetchData = useCallback(async (ym: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/calendar?month=${ym}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          // セッション切れ → ログインページへ（自動で再ログインされる）
          window.location.href = "/login?error=SessionExpired&callbackUrl=/chart";
          return;
        }
        setError(data.error ?? "データの取得に失敗しました");
        return;
      }
      // イベントがある収入源のみ表示
      const active = (data.salaries ?? []).filter(
        (s: SalaryBreakdown) => s.source.is_active && s.total > 0
      );
      setSalaries(active);
      setActiveIndex(0);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
      // 中身が出揃ったのでスプラッシュを終了させる
      markAppReady();
    }
  }, []);

  useEffect(() => {
    fetchData(yearMonth);
  }, [yearMonth, fetchData]);

  // 前月・翌月に移動
  const moveMonth = (delta: number) => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setYearMonth(toYearMonth(d));
    setActiveIndex(0);
  };

  // 円グラフ用データ
  const chartData = salaries.map((s) => ({
    name: s.source.name,
    value: s.total,
  }));

  // 合計金額
  const grandTotal = salaries.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="p-4 pb-24">
      {/* ヘッダー */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
          収入推定グラフ
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

      {/* ローディング */}
      {loading && (
        <div className="text-center py-16 text-gray-400 text-sm">
          読み込み中...
        </div>
      )}

      {/* エラー */}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* データなし */}
      {!loading && !error && salaries.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <CalendarIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 text-sm">
            {formatYearMonth(yearMonth)}の予定が見つかりませんでした
          </p>
        </div>
      )}

      {/* 円グラフ */}
      {!loading && !error && salaries.length > 0 && (
        <>
          {/* グラフ本体 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
            {/* 合計表示 */}
            <div className="text-center mb-2">
              <p className="text-xs text-gray-400">推定収入合計</p>
              <p className="text-3xl font-bold text-gray-900">{yen(grandTotal)}</p>
            </div>

            {/* 円グラフ（タップでセクター拡大） */}
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  activeIndex={activeIndex}
                  activeShape={renderActiveShape}
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={100}
                  dataKey="value"
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onClick={(_, index) => setActiveIndex(index)}
                  strokeWidth={2}
                  stroke="#fff"
                >
                  {chartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* 凡例 */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-1">
              {salaries.map((s, i) => (
                <button
                  key={s.source.id}
                  onClick={() => setActiveIndex(i)}
                  className={`btn3d btn3d-sm px-3 py-1.5 text-sm ${
                    activeIndex === i ? "btn-soft-blue" : "btn-soft-gray"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-gray-700">{s.source.name}</span>
                  <span className="text-gray-500">{yen(s.total)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 選択中の収入源の詳細 */}
          <p className="text-xs text-gray-400 font-medium mb-2 px-1">
            収入源の内訳（タップで切り替え）
          </p>
          {salaries[activeIndex] && (
            <DetailPanel
              salary={salaries[activeIndex]}
              color={COLORS[activeIndex % COLORS.length]}
            />
          )}

          {/* 注記 */}
          <p className="text-xs text-gray-400 text-center mt-4 leading-relaxed px-2">
            推定収入は月内の全予定（過去・未来含む）から算出しています。
            税金・保険料差し引き前の金額です。
          </p>
        </>
      )}
    </div>
  );
}
