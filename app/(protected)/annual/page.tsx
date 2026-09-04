"use client";

import { useEffect, useState, useCallback } from "react";
import type { IncomeSource, MonthlyRecord, ExtraIncome } from "@/types/database";

function yen(n: number): string {
  return `¥${Math.floor(n).toLocaleString()}`;
}

// "2026-03" → "3月"
function monthLabel(ym: string): string {
  return `${Number(ym.split("-")[1])}月`;
}

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0")
);

// 控除額合計（所得税＋その他控除）
function deductionOf(r: MonthlyRecord): number {
  return r.income_tax + r.other_deduction;
}

// 口座入金額（支給額合計 − 控除額合計）
function takeHomeOf(r: MonthlyRecord): number {
  return r.gross_amount - deductionOf(r);
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
  const recordMap = new Map(records.map((r) => [r.year_month, r]));
  const annualGross = records.reduce((s, r) => s + r.gross_amount, 0);
  const annualTakeHome = records.reduce((s, r) => s + takeHomeOf(r), 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800 text-sm">{source.name}</h3>
        <div className="text-xs text-gray-500">
          合計 <span className="font-semibold text-blue-600">{yen(annualGross)}</span>
          　入金 <span className="font-semibold text-gray-700">{yen(annualTakeHome)}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 px-4 py-1.5 text-xs text-gray-400 border-b border-gray-50">
        <span>月</span>
        <span className="text-right">支給額</span>
        <span className="text-right">口座入金</span>
        <span className="text-right">操作</span>
      </div>

      <div className="divide-y divide-gray-50">
        {MONTHS.map((mm) => {
          const ym = `${year}-${mm}`;
          const rec = recordMap.get(ym) ?? null;
          const takeHome = rec ? takeHomeOf(rec) : 0;

          return (
            <div key={ym} className="grid grid-cols-4 items-center px-4 py-2.5">
              <span className="text-sm text-gray-700 font-medium">{monthLabel(ym)}</span>
              <span className="text-sm text-right text-gray-800">
                {rec ? yen(rec.gross_amount) : <span className="text-gray-300">—</span>}
              </span>
              <span className="text-sm text-right text-blue-600 font-medium">
                {rec ? yen(takeHome) : <span className="text-gray-300">—</span>}
              </span>
              <div className="text-right">
                <button
                  onClick={() => onEdit({ source, yearMonth: ym, record: rec })}
                  className={`btn3d btn3d-sm text-xs px-3 py-1.5 ${
                    rec ? "btn-soft-gray" : "btn-soft-blue"
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
// その他収入タブ（タイミー等の臨時収入を月別に管理）
// =============================================
function ExtraTable({
  year,
  extraIncomes,
  onEditExtra,
}: {
  year: number;
  extraIncomes: ExtraIncome[];
  onEditExtra: (yearMonth: string, record: ExtraIncome | null) => void;
}) {
  const extraMap = new Map(extraIncomes.map((e) => [e.year_month, e]));
  const annualExtra = extraIncomes.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800 text-sm">その他収入</h3>
        <div className="text-xs text-gray-500">
          年間合計{" "}
          <span className="font-semibold text-emerald-600">{yen(annualExtra)}</span>
        </div>
      </div>

      <div className="grid grid-cols-[3rem_1fr_1fr_4rem] px-4 py-1.5 text-xs text-gray-400 border-b border-gray-50">
        <span>月</span>
        <span className="text-right">金額</span>
        <span className="text-right">メモ</span>
        <span className="text-right">操作</span>
      </div>

      <div className="divide-y divide-gray-50">
        {MONTHS.map((mm) => {
          const ym = `${year}-${mm}`;
          const extra = extraMap.get(ym) ?? null;
          const amount = extra?.amount ?? 0;

          return (
            <div
              key={ym}
              className="grid grid-cols-[3rem_1fr_1fr_4rem] items-center px-4 py-2.5"
            >
              <span className="text-sm text-gray-700 font-medium">{monthLabel(ym)}</span>
              <span
                className={`text-sm text-right font-medium ${
                  amount > 0 ? "text-emerald-600" : "text-gray-200"
                }`}
              >
                {amount > 0 ? yen(amount) : "—"}
              </span>
              <span className="text-xs text-right text-gray-500 truncate pl-2">
                {extra?.memo ? extra.memo : <span className="text-gray-200">—</span>}
              </span>
              <div className="text-right">
                <button
                  onClick={() => onEditExtra(ym, extra)}
                  className={`btn3d btn3d-sm text-xs px-3 py-1.5 ${
                    amount > 0 ? "btn-soft-gray" : "btn-soft-emerald"
                  }`}
                >
                  {amount > 0 ? "編集" : "入力"}
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
// 合計タブ（全収入源＋その他収入の月次合計）
// 収入源ごとの内訳は出さず、合計・控除・口座入金額のみを表示する
// =============================================
function TotalTable({
  year,
  records,
  extraIncomes,
}: {
  year: number;
  records: MonthlyRecord[];
  extraIncomes: ExtraIncome[];
}) {
  const extraMap = new Map(extraIncomes.map((e) => [e.year_month, e]));
  const annualExtra = extraIncomes.reduce((s, e) => s + e.amount, 0);
  // その他収入は控除がないため、全額がそのまま入金額に反映される
  const annualGross = records.reduce((s, r) => s + r.gross_amount, 0) + annualExtra;
  const annualDeduction = records.reduce((s, r) => s + deductionOf(r), 0);
  const annualTakeHome = annualGross - annualDeduction;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-800 text-sm">全収入源 合計</h3>
          <span className="text-base font-bold text-blue-600">{yen(annualGross)}</span>
        </div>
        <div className="flex justify-end gap-3 text-xs text-gray-500 mt-0.5">
          <span>
            控除 <span className="font-semibold text-red-500">−{yen(annualDeduction)}</span>
          </span>
          <span>
            口座入金 <span className="font-semibold text-gray-700">{yen(annualTakeHome)}</span>
          </span>
        </div>
      </div>

      {/* 列ヘッダー */}
      <div className="grid grid-cols-[3rem_1fr_1fr_1fr] px-4 py-1.5 text-xs text-gray-400 border-b border-gray-50">
        <span>月</span>
        <span className="text-right">合計</span>
        <span className="text-right">控除</span>
        <span className="text-right">口座入金</span>
      </div>

      <div className="divide-y divide-gray-50">
        {MONTHS.map((mm) => {
          const ym = `${year}-${mm}`;
          const monthRecords = records.filter((r) => r.year_month === ym);
          const extraAmount = extraMap.get(ym)?.amount ?? 0;
          const gross =
            monthRecords.reduce((s, r) => s + r.gross_amount, 0) + extraAmount;
          const deduction = monthRecords.reduce((s, r) => s + deductionOf(r), 0);
          const hasData = monthRecords.length > 0 || extraAmount > 0;

          return (
            <div
              key={ym}
              className="grid grid-cols-[3rem_1fr_1fr_1fr] items-center px-4 py-2.5"
            >
              <span className="text-sm text-gray-700 font-medium">{monthLabel(ym)}</span>
              <span
                className={`text-sm text-right font-semibold ${
                  hasData ? "text-blue-600" : "text-gray-200"
                }`}
              >
                {hasData ? yen(gross) : "—"}
              </span>
              <span
                className={`text-sm text-right ${
                  deduction > 0 ? "text-red-500" : "text-gray-200"
                }`}
              >
                {deduction > 0 ? `−${yen(deduction)}` : "—"}
              </span>
              <span
                className={`text-sm text-right font-semibold ${
                  hasData ? "text-gray-800" : "text-gray-200"
                }`}
              >
                {hasData ? yen(gross - deduction) : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================
// その他収入の入力ボトムシート
// =============================================
function ExtraIncomeSheet({
  yearMonth,
  record,
  onClose,
  onSaved,
}: {
  yearMonth: string;
  record: ExtraIncome | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(record?.amount ? record.amount.toString() : "");
  const [memo, setMemo] = useState(record?.memo ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/extra-incomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year_month: yearMonth,
          amount: Number(amount) || 0,
          memo,
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

  return (
    <div className="fixed inset-0 z-[60] bg-black/30 flex items-end sm:items-center sm:justify-center overlay-fade-in" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-5 pb-8 sheet-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">
            {monthLabel(yearMonth)}のその他収入
          </h3>
          <button
            onClick={onClose}
            className="btn-press w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-gray-400 mb-4">
          タイミー等の臨時収入を入力します。合計に加算されます。
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">金額（円）</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="例：15000"
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">メモ（任意）</label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="例：タイミー"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
            {error}
          </p>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="btn3d btn-neutral flex-1 py-3 text-sm"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn3d btn-success flex-1 py-3 text-sm"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
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
  other_deduction: string;
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
    other_deduction: target.record?.other_deduction.toString() ?? "",
    other_pay: target.record?.other_pay.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const n = (v: string) => Number(v) || 0;
  // 控除額合計＝所得税＋その他控除、口座入金額＝支給額合計−控除額合計
  const deductionTotal = n(form.income_tax) + n(form.other_deduction);
  const takeHome = n(form.gross_amount) - deductionTotal;

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
    <div className="fixed inset-0 z-[60] bg-white flex flex-col sheet-from-right">
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button
          onClick={onClose}
          className="btn-press w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
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

      <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
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
          <NumField label="その他控除（雇用保険等）" field="other_deduction" />
          <NumField label="その他支給" field="other_pay" />
        </div>

        <div className="bg-blue-50 rounded-xl px-4 py-3 space-y-1.5">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">控除額合計</span>
            <span className="font-semibold text-red-500">−{yen(deductionTotal)}</span>
          </div>
          <div className="flex justify-between items-center border-t border-blue-100 pt-1.5">
            <span className="text-sm font-medium text-blue-700">口座入金額</span>
            <span className="text-xl font-bold text-blue-700">{yen(takeHome)}</span>
          </div>
        </div>
      </div>

      <div className="shrink-0 px-4 pt-3 pb-6 border-t border-gray-100 bg-white">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="btn3d btn-neutral flex-1 py-3 text-sm"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn3d btn-primary flex-1 py-3 text-sm"
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
  const [extraIncomes, setExtraIncomes] = useState<ExtraIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // sources.length が合計タブのインデックス
  const [activeTab, setActiveTab] = useState(0);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  // その他収入の編集対象（年月）
  const [extraTarget, setExtraTarget] = useState<{ yearMonth: string; record: ExtraIncome | null } | null>(null);

  const fetchAll = useCallback(async (y: number) => {
    setLoading(true);
    setError("");
    try {
      const [srcRes, recRes, extraRes] = await Promise.all([
        fetch("/api/income-sources"),
        fetch(`/api/monthly-records?year=${y}`),
        fetch(`/api/extra-incomes?year=${y}`),
      ]);

      if (!srcRes.ok || !recRes.ok || !extraRes.ok) {
        setError("データの取得に失敗しました");
        return;
      }

      const [srcData, recData, extraData] = await Promise.all([
        srcRes.json(),
        recRes.json(),
        extraRes.json(),
      ]);

      setSources(srcData.filter((s: IncomeSource) => s.is_active));
      setRecords(recData);
      setExtraIncomes(extraData);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(year);
  }, [year, fetchAll]);

  const recordsBySource = (sourceId: string) =>
    records.filter((r) => r.income_source_id === sourceId);

  // タブ並び：収入源... → その他 → 合計
  const extraTabIndex = sources.length;
  const totalTabIndex = sources.length + 1;
  const isExtra = activeTab === extraTabIndex;
  const isTotal = activeTab === totalTabIndex;

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
            className="btn-press w-10 h-10 flex items-center justify-center text-xl text-gray-500 hover:bg-gray-100 rounded-xl"
            aria-label="前の年"
          >
            ‹
          </button>
          <h1 className="text-xl font-bold text-gray-900">{year}年</h1>
          <button
            onClick={() => { setYear((y) => y + 1); setActiveTab(0); }}
            className="btn-press w-10 h-10 flex items-center justify-center text-xl text-gray-500 hover:bg-gray-100 rounded-xl"
            aria-label="次の年"
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
          {/* 月次データ */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 font-medium">月次データ</p>
          </div>

          {/* クイックリンク */}
          <div className="flex gap-2 mb-3">
            <a
              href="https://plenus-cws.company.works-hi.com/self-workflow/csd/main"
              target="_blank"
              rel="noopener noreferrer"
              className="btn3d btn-soft-orange flex-1 py-2.5 text-xs"
            >
              やよい軒 明細
            </a>
            <a
              href="https://kdedu.smarthr.jp/payslips?ref_notification_id=44ea7435-0925-4ca3-87a3-802a456b95e7"
              target="_blank"
              rel="noopener noreferrer"
              className="btn3d btn-soft-purple flex-1 py-2.5 text-xs"
            >
              N高 明細
            </a>
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
              {/* 収入源タブ + 合計タブ */}
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                {sources.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveTab(i)}
                    className={`btn3d btn3d-sm shrink-0 px-4 py-1.5 text-sm ${
                      activeTab === i ? "btn-primary" : "btn-soft-gray"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
                {/* その他タブ */}
                <button
                  onClick={() => setActiveTab(extraTabIndex)}
                  className={`btn3d btn3d-sm shrink-0 px-4 py-1.5 text-sm ${
                    isExtra ? "btn-success" : "btn-soft-gray"
                  }`}
                >
                  その他
                </button>
                {/* 合計タブ */}
                <button
                  onClick={() => setActiveTab(totalTabIndex)}
                  className={`btn3d btn3d-sm shrink-0 px-4 py-1.5 text-sm ${
                    isTotal ? "btn-primary" : "btn-soft-gray"
                  }`}
                >
                  合計
                </button>
              </div>

              {isTotal ? (
                <TotalTable
                  year={year}
                  records={records}
                  extraIncomes={extraIncomes}
                />
              ) : isExtra ? (
                <ExtraTable
                  year={year}
                  extraIncomes={extraIncomes}
                  onEditExtra={(yearMonth, record) => setExtraTarget({ yearMonth, record })}
                />
              ) : (
                sources[activeTab] && (
                  <MonthlyTable
                    year={year}
                    source={sources[activeTab]}
                    records={recordsBySource(sources[activeTab].id)}
                    onEdit={setEditTarget}
                  />
                )
              )}
            </>
          )}
        </>
      )}

      {/* 編集シート */}
      {editTarget && (
        <EditSheet
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => fetchAll(year)}
        />
      )}

      {/* その他収入シート */}
      {extraTarget && (
        <ExtraIncomeSheet
          yearMonth={extraTarget.yearMonth}
          record={extraTarget.record}
          onClose={() => setExtraTarget(null)}
          onSaved={() => fetchAll(year)}
        />
      )}
    </div>
  );
}
