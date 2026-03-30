"use client";

import { useEffect, useState, useCallback } from "react";
import { calcSalaryDeduction, calcIncomeTax, calcResidentTax } from "@/lib/tax";
import type { IncomeSource, MonthlyRecord } from "@/types/database";
import PayslipUploader from "@/components/PayslipUploader";

// =============================================
// ユーティリティ
// =============================================

function yen(n: number): string {
  return `¥${Math.floor(n).toLocaleString()}`;
}

function man(n: number): string {
  return `¥${(n / 10000).toFixed(1)}万`;
}

// =============================================
// CSVエクスポートユーティリティ
// =============================================

// セル値をCSV安全な形式にエスケープ
function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// 2次元配列からCSV文字列を生成
function buildCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

// UTF-8 BOM付きでCSVファイルをダウンロード（NotionやExcelの文字化け防止）
function downloadCsv(filename: string, content: string): void {
  const bom = "\uFEFF";
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// "2026-03" → "3月"
function monthLabel(ym: string): string {
  return `${Number(ym.split("-")[1])}月`;
}

// 月一覧（01〜12）
const MONTHS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0")
);

// =============================================
// 収入の壁 定義
// =============================================
type Wall = {
  key: string;
  label: string;
  description: string;
  amount: number;
  color: string;
  textColor: string;
};

// =============================================
// 収入の壁カード
// =============================================
function WallCard({
  wall,
  currentIncome,
}: {
  wall: Wall;
  currentIncome: number;
}) {
  const pct = Math.min(100, (currentIncome / wall.amount) * 100);
  const exceeded = currentIncome >= wall.amount;
  const warning = !exceeded && pct >= 85;
  const remaining = wall.amount - currentIncome;

  return (
    <div
      className={`rounded-xl p-3 border ${
        exceeded
          ? "bg-red-50 border-red-200"
          : warning
          ? "bg-amber-50 border-amber-200"
          : "bg-white border-gray-100"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-gray-800">{wall.label}</span>
        {exceeded ? (
          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
            超過
          </span>
        ) : warning ? (
          <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-medium">
            注意
          </span>
        ) : (
          <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">
            安全
          </span>
        )}
      </div>

      {/* プログレスバー */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5">
        <div
          className={`h-full rounded-full transition-all ${
            exceeded ? "bg-red-400" : warning ? "bg-amber-400" : "bg-blue-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-between items-center text-xs text-gray-500">
        <span>
          {exceeded ? (
            <span className="text-red-600 font-medium">
              {man(Math.abs(remaining))} 超過
            </span>
          ) : (
            <span>残り {man(remaining)}</span>
          )}
        </span>
        <span>
          {man(currentIncome)} / {man(wall.amount)}
        </span>
      </div>

      <p className="text-xs text-gray-400 mt-1">{wall.description}</p>
    </div>
  );
}

// =============================================
// 年間集計カード
// =============================================
type AnnualSummaryProps = {
  annualGross: number;
  annualIncomeTax: number;
  basicDeduction: number;
};

function AnnualSummaryCard({
  annualGross,
  annualIncomeTax,
  basicDeduction,
}: AnnualSummaryProps) {
  const salaryDeduction = calcSalaryDeduction(annualGross);
  const salaryIncome = Math.max(0, annualGross - salaryDeduction);
  const taxableIncome = Math.max(0, salaryIncome - basicDeduction);
  const estimatedIncomeTax = calcIncomeTax(taxableIncome);
  const estimatedResidentTax = calcResidentTax(taxableIncome);
  // 手取り = 支給額合計 - 所得税合計
  const annualTakeHome = annualGross - annualIncomeTax;

  const rows: { label: string; value: number; sub?: boolean; deduct?: boolean; bold?: boolean }[] = [
    { label: "年間支給額合計", value: annualGross, bold: true },
    { label: "給与所得控除", value: salaryDeduction, sub: true, deduct: true },
    { label: "給与所得", value: salaryIncome, bold: true },
    { label: "基礎控除", value: basicDeduction, sub: true, deduct: true },
    { label: "課税所得（概算）", value: taxableIncome, bold: true },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800 text-sm">年間集計</h2>
      </div>
      <div className="px-4 py-2 divide-y divide-gray-50">
        {rows.map((r) => (
          <div
            key={r.label}
            className={`flex justify-between items-center py-2 ${r.sub ? "pl-3" : ""}`}
          >
            <span className={`text-sm ${r.bold ? "font-semibold text-gray-800" : "text-gray-500"}`}>
              {r.deduct && <span className="text-gray-300 mr-1">−</span>}
              {r.label}
            </span>
            <span className={`text-sm font-medium ${r.bold ? "text-gray-900" : r.deduct ? "text-gray-500" : "text-gray-700"}`}>
              {yen(r.value)}
            </span>
          </div>
        ))}
      </div>

      {/* 税額推定 */}
      <div className="mx-4 mb-4 mt-2 bg-blue-50 rounded-xl p-3">
        <p className="text-xs text-blue-600 font-medium mb-2">推定税額（概算）</p>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">所得税（推定）</span>
            <span className="font-semibold text-gray-800">{yen(estimatedIncomeTax)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">住民税（推定）</span>
            <span className="font-semibold text-gray-800">{yen(estimatedResidentTax)}</span>
          </div>
          {annualIncomeTax > 0 && (
            <div className="flex justify-between text-xs text-gray-500 border-t border-blue-100 pt-1.5 mt-1.5">
              <span>所得税（源泉徴収済合計）</span>
              <span>{yen(annualIncomeTax)}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between text-sm font-semibold text-blue-700 mt-2 pt-2 border-t border-blue-100">
          <span>年間手取り（概算）</span>
          <span>{yen(annualTakeHome)}</span>
        </div>
        <p className="text-xs text-blue-400 mt-2">
          ※給与所得控除・基礎控除のみ適用した概算です
        </p>
      </div>
    </div>
  );
}

// =============================================
// 月次データテーブル（収入源1件）
// =============================================
type EditTarget = {
  source: IncomeSource;
  yearMonth: string;
  record: MonthlyRecord | null;
};

function MonthlyTable({
  year,
  source,
  records,
  onEdit,
}: {
  year: number;
  source: IncomeSource;
  records: MonthlyRecord[];
  onEdit: (target: EditTarget) => void;
}) {
  // この収入源の年間記録マップ（year_month → record）
  const recordMap = new Map(records.map((r) => [r.year_month, r]));

  const annualGross = records.reduce((s, r) => s + r.gross_amount, 0);
  // 手取り = 支給額合計 - 所得税
  const annualTakeHome = records.reduce((s, r) => s + r.gross_amount - r.income_tax, 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* ヘッダー */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800 text-sm">{source.name}</h3>
        <div className="text-xs text-gray-500">
          合計 <span className="font-semibold text-gray-800">{yen(annualGross)}</span>
          　手取 <span className="font-semibold text-blue-600">{yen(annualTakeHome)}</span>
        </div>
      </div>

      {/* 列ヘッダー */}
      <div className="grid grid-cols-4 px-4 py-1.5 text-xs text-gray-400 border-b border-gray-50">
        <span>月</span>
        <span className="text-right">支給額</span>
        <span className="text-right">手取り</span>
        <span className="text-right">操作</span>
      </div>

      {/* 12ヶ月分の行 */}
      <div className="divide-y divide-gray-50">
        {MONTHS.map((mm) => {
          const ym = `${year}-${mm}`;
          const rec = recordMap.get(ym) ?? null;
          // 手取り = 支給額合計 - 所得税
          const takeHome = rec ? rec.gross_amount - rec.income_tax : 0;

          return (
            <div
              key={ym}
              className="grid grid-cols-4 items-center px-4 py-2.5"
            >
              <span className="text-sm text-gray-700 font-medium">
                {monthLabel(ym)}
              </span>
              <span className="text-sm text-right text-gray-800">
                {rec ? yen(rec.gross_amount) : <span className="text-gray-300">—</span>}
              </span>
              <span className="text-sm text-right text-blue-600 font-medium">
                {rec ? yen(takeHome) : <span className="text-gray-300">—</span>}
              </span>
              <div className="text-right">
                <button
                  onClick={() => onEdit({ source, yearMonth: ym, record: rec })}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    rec
                      ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                  }`}
                >
                  {rec ? "編集" : "入力"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================
// 編集ボトムシート
// =============================================
type EditFormState = {
  gross_amount: string;
  transport_allowance: string;
  taxable_amount: string;
  income_tax: string;
  other_pay: string;
};

function EditSheet({
  target,
  onClose,
  onSaved,
}: {
  target: EditTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EditFormState>({
    gross_amount: target.record?.gross_amount.toString() ?? "",
    transport_allowance: target.record?.transport_allowance.toString() ?? "",
    taxable_amount: target.record?.taxable_amount.toString() ?? "",
    income_tax: target.record?.income_tax.toString() ?? "",
    other_pay: target.record?.other_pay.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const n = (v: string) => Number(v) || 0;

  // 手取り = 支給額合計 - 所得税
  const takeHome = n(form.gross_amount) - n(form.income_tax);

  const setField = (key: keyof EditFormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/monthly-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          income_source_id: target.source.id,
          income_source_name: target.source.name,
          year_month: target.yearMonth,
          ...Object.fromEntries(
            Object.entries(form).map(([k, v]) => [k, Number(v) || 0])
          ),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "保存に失敗しました");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  // 数値入力フィールドのヘルパー
  const NumField = ({
    label,
    field,
    placeholder = "0",
  }: {
    label: string;
    field: keyof EditFormState;
    placeholder?: string;
  }) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={form[field]}
        onChange={(e) => setField(field, e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  return (
    /* フルスクリーンモーダル：ナビバー(z-50)より上の z-[60] で全面表示 */
    <div className="fixed inset-0 z-[60] bg-white flex flex-col">
      {/* ヘッダー（固定） */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="閉じる"
        >
          ✕
        </button>
        <div>
          <h3 className="font-semibold text-gray-800 leading-tight">
            {monthLabel(target.yearMonth)}　{target.source.name}
          </h3>
          <p className="text-xs text-gray-400">{target.yearMonth}</p>
        </div>
      </div>

      {/* スクロール可能なコンテンツ */}
      <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
        {/* 支給額合計（目立たせる） */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            支給額合計<span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={form.gross_amount}
            onChange={(e) => setField("gross_amount", e.target.value)}
            placeholder="例：80000"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumField label="通勤手当" field="transport_allowance" />
          <NumField label="課税対象額計" field="taxable_amount" />
          <NumField label="所得税（源泉徴収）" field="income_tax" />
          <NumField label="その他支給" field="other_pay" />
        </div>

        {/* 手取り表示 */}
        <div className="bg-blue-50 rounded-xl px-4 py-3 flex justify-between items-center">
          <span className="text-sm font-medium text-blue-700">手取り（概算）</span>
          <span className="text-xl font-bold text-blue-700">{yen(takeHome)}</span>
        </div>
      </div>

      {/* フッター：ボタン固定（常に画面下部に表示） */}
      <div className="shrink-0 px-4 pt-3 pb-6 border-t border-gray-100 bg-white">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// メインページ
// =============================================
export default function AnnualPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [records, setRecords] = useState<MonthlyRecord[]>([]);
  const [taxSettings, setTaxSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  // データをまとめて取得
  const fetchAll = useCallback(async (y: number) => {
    setLoading(true);
    setError("");
    try {
      const [srcRes, recRes, taxRes] = await Promise.all([
        fetch("/api/income-sources"),
        fetch(`/api/monthly-records?year=${y}`),
        fetch("/api/tax-settings"),
      ]);

      if (!srcRes.ok || !recRes.ok || !taxRes.ok) {
        setError("データの取得に失敗しました");
        return;
      }

      const [srcData, recData, taxData] = await Promise.all([
        srcRes.json(),
        recRes.json(),
        taxRes.json(),
      ]);

      setSources(srcData.filter((s: IncomeSource) => s.is_active));
      setRecords(recData);
      setTaxSettings(taxData);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(year);
  }, [year, fetchAll]);

  // 年間集計値
  const annualGross = records.reduce((s, r) => s + r.gross_amount, 0);
  const annualIncomeTax = records.reduce((s, r) => s + r.income_tax, 0);
  const basicDeduction = Number(taxSettings["basic_deduction"] ?? 480000);

  // 収入の壁定義
  const walls: Wall[] = [
    {
      key: "resident_tax",
      label: "住民税の壁（100万）",
      description: "課税所得が発生し、住民税が課税されます",
      amount: 1000000,
      color: "bg-purple-400",
      textColor: "text-purple-600",
    },
    {
      key: "wall_103",
      label: "103万の壁",
      description: "所得税が発生。扶養している方の控除が減る可能性があります",
      amount: Number(taxSettings["wall_103"] ?? 1030000),
      color: "bg-blue-400",
      textColor: "text-blue-600",
    },
    {
      key: "wall_106",
      label: "106万の壁",
      description: "一定規模の会社で勤める場合、社会保険への加入が必要になります",
      amount: Number(taxSettings["wall_106"] ?? 1060000),
      color: "bg-amber-400",
      textColor: "text-amber-600",
    },
    {
      key: "wall_130",
      label: "130万の壁",
      description: "健康保険の被扶養者から外れ、自身で保険に加入が必要になります",
      amount: Number(taxSettings["wall_130"] ?? 1300000),
      color: "bg-red-400",
      textColor: "text-red-600",
    },
  ];

  // 収入源ごとの記録を分割
  const recordsBySource = (sourceId: string) =>
    records.filter((r) => r.income_source_id === sourceId);

  // -------------------------------------------------------
  // CSVエクスポート：月次明細
  // Notionのデータベースに直接インポートできるフラット形式
  // 列: 収入源 / 年月(Date) / 支給額合計 / 通勤手当 / 課税対象額計 / 所得税 / 手取り
  // -------------------------------------------------------
  const exportMonthlyCsv = () => {
    const header = [
      "収入源",
      "年月",
      "支給額合計",
      "通勤手当",
      "課税対象額計",
      "所得税（源泉徴収）",
      "その他支給",
      "手取り",
    ];

    // 入力済みレコードのみ・年月昇順
    const rows = records
      .slice()
      .sort((a, b) => a.year_month.localeCompare(b.year_month))
      .map((r) => {
        // Notion の Date プロパティは YYYY-MM-DD 形式を認識する
        const dateStr = `${r.year_month}-01`;
        const takeHome = r.gross_amount - r.income_tax;
        return [
          r.income_source_name,
          dateStr,
          r.gross_amount,
          r.transport_allowance,
          r.taxable_amount,
          r.income_tax,
          r.other_pay,
          takeHome,
        ];
      });

    downloadCsv(
      `給与明細_月次_${year}.csv`,
      buildCsv([header, ...rows])
    );
  };

  // -------------------------------------------------------
  // CSVエクスポート：年間集計
  // 収入源ごとの年間合計＋全体合計行
  // -------------------------------------------------------
  const exportAnnualCsv = () => {
    const header = [
      "収入源",
      "年度",
      "年間支給額合計",
      "年間通勤手当",
      "年間課税対象額計",
      "年間所得税（源泉徴収）",
      "年間その他支給",
      "年間手取り",
    ];

    const sourceRows = sources.map((src) => {
      const recs = recordsBySource(src.id);
      const gross = recs.reduce((s, r) => s + r.gross_amount, 0);
      const transport = recs.reduce((s, r) => s + r.transport_allowance, 0);
      const taxable = recs.reduce((s, r) => s + r.taxable_amount, 0);
      const tax = recs.reduce((s, r) => s + r.income_tax, 0);
      const otherPay = recs.reduce((s, r) => s + r.other_pay, 0);
      const takeHome = gross - tax;
      return [src.name, year, gross, transport, taxable, tax, otherPay, takeHome];
    });

    // 全体合計行
    const totalGross = records.reduce((s, r) => s + r.gross_amount, 0);
    const totalTransport = records.reduce((s, r) => s + r.transport_allowance, 0);
    const totalTaxable = records.reduce((s, r) => s + r.taxable_amount, 0);
    const totalTax = records.reduce((s, r) => s + r.income_tax, 0);
    const totalOtherPay = records.reduce((s, r) => s + r.other_pay, 0);
    const totalTakeHome = totalGross - totalTax;
    const totalRow = ["合計", year, totalGross, totalTransport, totalTaxable, totalTax, totalOtherPay, totalTakeHome];

    downloadCsv(
      `給与明細_年間集計_${year}.csv`,
      buildCsv([header, ...sourceRows, totalRow])
    );
  };

  return (
    <div className="p-4 pb-24">
      {/* ヘッダー */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
          年間収入データベース
        </p>
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setYear((y) => y - 1); setActiveTab(0); }}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            ‹
          </button>
          <h1 className="text-xl font-bold text-gray-900">{year}年</h1>
          <button
            onClick={() => { setYear((y) => y + 1); setActiveTab(0); }}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            ›
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-16 text-gray-400 text-sm">読み込み中...</div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ===================== 収入の壁 ===================== */}
          <div className="mb-4">
            <p className="text-xs text-gray-500 font-medium mb-2">収入の壁</p>
            <div className="space-y-2">
              {walls.map((w) => (
                <WallCard key={w.key} wall={w} currentIncome={annualGross} />
              ))}
            </div>
          </div>

          {/* ===================== 年間集計 ===================== */}
          {annualGross > 0 && (
            <div className="mb-4">
              <AnnualSummaryCard
                annualGross={annualGross}
                annualIncomeTax={annualIncomeTax}
                basicDeduction={basicDeduction}
              />
            </div>
          )}

          {/* ===================== 月次データ ===================== */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 font-medium">月次データ</p>
            {/* 給与明細画像アップロード */}
            <PayslipUploader
              sources={sources}
              onSaved={() => fetchAll(year)}
            />
          </div>

          {sources.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <p className="text-gray-500 text-sm mb-2">収入源が登録されていません</p>
              <a href="/settings" className="text-blue-600 text-sm font-medium">
                設定から収入源を追加する →
              </a>
            </div>
          ) : (
            <>
              {/* 収入源タブ */}
              {sources.length > 1 && (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                  {sources.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => setActiveTab(i)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        activeTab === i
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}

              {sources[activeTab] && (
                <MonthlyTable
                  year={year}
                  source={sources[activeTab]}
                  records={recordsBySource(sources[activeTab].id)}
                  onEdit={setEditTarget}
                />
              )}
            </>
          )}

          {/* ===================== CSVエクスポート ===================== */}
          {records.length > 0 && (
            <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 font-medium mb-3">CSVエクスポート</p>
              <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                NotionのデータベースにCSVとしてインポートできます。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={exportMonthlyCsv}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <span>📥</span>
                  <span>月次明細</span>
                </button>
                <button
                  onClick={exportAnnualCsv}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <span>📥</span>
                  <span>年間集計</span>
                </button>
              </div>
            </div>
          )}

          {/* 注記 */}
          <p className="text-xs text-gray-400 text-center mt-4 leading-relaxed px-2">
            税額は給与所得控除・基礎控除のみ適用した概算です。
            実際の納税額は確定申告または年末調整で確定します。
          </p>
        </>
      )}

      {/* ===================== 編集ボトムシート ===================== */}
      {editTarget && (
        <EditSheet
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => fetchAll(year)}
        />
      )}
    </div>
  );
}
