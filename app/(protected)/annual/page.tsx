"use client";

import { useEffect, useState, useCallback } from "react";
import type { IncomeSource, MonthlyRecord } from "@/types/database";

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
  const annualTakeHome = records.reduce((s, r) => s + r.gross_amount - r.income_tax, 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800 text-sm">{source.name}</h3>
        <div className="text-xs text-gray-500">
          合計 <span className="font-semibold text-gray-800">{yen(annualGross)}</span>
          　手取 <span className="font-semibold text-blue-600">{yen(annualTakeHome)}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 px-4 py-1.5 text-xs text-gray-400 border-b border-gray-50">
        <span>月</span>
        <span className="text-right">支給額</span>
        <span className="text-right">手取り</span>
        <span className="text-right">操作</span>
      </div>

      <div className="divide-y divide-gray-50">
        {MONTHS.map((mm) => {
          const ym = `${year}-${mm}`;
          const rec = recordMap.get(ym) ?? null;
          const takeHome = rec ? rec.gross_amount - rec.income_tax : 0;

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
// 合計タブ（全収入源の月次合計）
// =============================================
function TotalTable({
  year,
  sources,
  records,
}: {
  year: number;
  sources: IncomeSource[];
  records: MonthlyRecord[];
}) {
  const annualGross = records.reduce((s, r) => s + r.gross_amount, 0);
  const annualTakeHome = records.reduce((s, r) => s + r.gross_amount - r.income_tax, 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800 text-sm">全収入源 合計</h3>
        <div className="text-xs text-gray-500">
          合計 <span className="font-semibold text-gray-800">{yen(annualGross)}</span>
          　手取 <span className="font-semibold text-blue-600">{yen(annualTakeHome)}</span>
        </div>
      </div>

      {/* 列ヘッダー */}
      <div
        className="px-4 py-1.5 text-xs text-gray-400 border-b border-gray-50"
        style={{ display: "grid", gridTemplateColumns: `4rem repeat(${sources.length + 1}, 1fr)` }}
      >
        <span>月</span>
        {sources.map((s) => (
          <span key={s.id} className="text-right truncate">{s.name}</span>
        ))}
        <span className="text-right font-medium text-gray-500">合計</span>
      </div>

      <div className="divide-y divide-gray-50">
        {MONTHS.map((mm) => {
          const ym = `${year}-${mm}`;
          const monthRecords = records.filter((r) => r.year_month === ym);
          const totalGross = monthRecords.reduce((s, r) => s + r.gross_amount, 0);
          const hasData = monthRecords.length > 0;

          // 収入源ごとの支給額
          const bySource = new Map(monthRecords.map((r) => [r.income_source_id, r.gross_amount]));

          return (
            <div
              key={ym}
              className="items-center px-4 py-2.5"
              style={{ display: "grid", gridTemplateColumns: `4rem repeat(${sources.length + 1}, 1fr)` }}
            >
              <span className="text-sm text-gray-700 font-medium">{monthLabel(ym)}</span>
              {sources.map((s) => {
                const val = bySource.get(s.id);
                return (
                  <span key={s.id} className="text-xs text-right text-gray-600">
                    {val != null ? yen(val) : <span className="text-gray-200">—</span>}
                  </span>
                );
              })}
              <span className={`text-sm text-right font-semibold ${hasData ? "text-blue-600" : "text-gray-200"}`}>
                {hasData ? yen(totalGross) : "—"}
              </span>
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
    <div className="fixed inset-0 z-[60] bg-white flex flex-col">
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
          <NumField label="その他支給" field="other_pay" />
        </div>

        <div className="bg-blue-50 rounded-xl px-4 py-3 flex justify-between items-center">
          <span className="text-sm font-medium text-blue-700">手取り（概算）</span>
          <span className="text-xl font-bold text-blue-700">{yen(takeHome)}</span>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // sources.length が合計タブのインデックス
  const [activeTab, setActiveTab] = useState(0);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const fetchAll = useCallback(async (y: number) => {
    setLoading(true);
    setError("");
    try {
      const [srcRes, recRes] = await Promise.all([
        fetch("/api/income-sources"),
        fetch(`/api/monthly-records?year=${y}`),
      ]);

      if (!srcRes.ok || !recRes.ok) {
        setError("データの取得に失敗しました");
        return;
      }

      const [srcData, recData] = await Promise.all([
        srcRes.json(),
        recRes.json(),
      ]);

      setSources(srcData.filter((s: IncomeSource) => s.is_active));
      setRecords(recData);
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

  // 合計タブのインデックス = sources.length
  const totalTabIndex = sources.length;
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
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-orange-50 border border-orange-200 rounded-xl text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors"
            >
              <span>🍱</span>
              <span>やよい軒 明細</span>
            </a>
            <a
              href="https://kdedu.smarthr.jp/payslips?ref_notification_id=44ea7435-0925-4ca3-87a3-802a456b95e7"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-purple-50 border border-purple-200 rounded-xl text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors"
            >
              <span>🎓</span>
              <span>N高 明細</span>
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
                    className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      activeTab === i
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
                {/* 合計タブ */}
                <button
                  onClick={() => setActiveTab(totalTabIndex)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isTotal
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  合計
                </button>
              </div>

              {isTotal ? (
                <TotalTable year={year} sources={sources} records={records} />
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
    </div>
  );
}
