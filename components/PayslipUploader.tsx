"use client";

import { useRef, useState } from "react";
import type { AnalyzeResult } from "@/app/api/analyze-payslip/route";
import type { IncomeSource } from "@/types/database";

// =============================================
// ユーティリティ
// =============================================
function yen(n: number): string {
  return `¥${Math.floor(n).toLocaleString()}`;
}

// =============================================
// 解析結果プレビュー・編集フォーム
// =============================================
type FormData = {
  income_source_id: string;
  year_month: string;
  gross_amount: string;
  transport_allowance: string;
  taxable_amount: string;
  income_tax: string;
  other_pay: string;
};

function PreviewSheet({
  result,
  sources,
  onSave,
  onCancel,
}: {
  result: AnalyzeResult;
  sources: IncomeSource[];
  onSave: (form: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormData>({
    income_source_id: sources[0]?.id ?? "",
    year_month: result.year_month,
    gross_amount: String(result.gross_amount),
    transport_allowance: String(result.transport_allowance),
    taxable_amount: String(result.taxable_amount),
    income_tax: String(result.income_tax),
    other_pay: String(result.other_pay),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const n = (v: string) => Number(v) || 0;
  // 手取り = 支給額合計 - 所得税
  const takeHome = n(form.gross_amount) - n(form.income_tax);

  const set = (key: keyof FormData, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.income_source_id) {
      setError("収入源を選択してください");
      return;
    }
    if (!form.year_month.match(/^\d{4}-\d{2}$/)) {
      setError("対象年月の形式が正しくありません（例: 2026-03）");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // 入力フィールドのヘルパー
  const Field = ({
    label,
    field,
    type = "number",
  }: {
    label: string;
    field: keyof FormData;
    type?: string;
  }) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-50">
      <span className="text-sm text-gray-600 shrink-0 w-36">{label}</span>
      <div className="flex items-center gap-1">
        {type === "number" && (
          <span className="text-xs text-gray-400">¥</span>
        )}
        <input
          type={type}
          inputMode={type === "number" ? "numeric" : "text"}
          value={form[field]}
          onChange={(e) => set(field, e.target.value)}
          className="w-32 text-right border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );

  return (
    /* フルスクリーンモーダル：ナビバー(z-50)より上の z-[60] で全面表示 */
    <div className="fixed inset-0 z-[60] bg-white flex flex-col">
      {/* ヘッダー（固定） */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="閉じる"
        >
          ✕
        </button>
        <div>
          <h3 className="font-semibold text-gray-800 leading-tight">解析結果の確認</h3>
          <p className="text-xs text-gray-400">内容を確認・修正してから保存してください</p>
        </div>
      </div>

      {/* スクロール可能なコンテンツ */}
      <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
        {/* OCR解析メモ */}
        {result.notes && (
          <div className="bg-blue-50 rounded-xl px-3 py-2 text-xs text-blue-600 leading-relaxed">
            💡 {result.notes}
          </div>
        )}

        {/* 収入源の選択 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">収入源</label>
          <select
            value={form.income_source_id}
            onChange={(e) => set("income_source_id", e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* 対象年月 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">対象年月</label>
          <input
            type="month"
            value={form.year_month}
            onChange={(e) => set("year_month", e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 支給・控除明細 */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">支給・控除金額</p>
          <div className="bg-gray-50 rounded-xl px-3 py-1">
            <Field label="支給額合計" field="gross_amount" />
            <Field label="通勤手当" field="transport_allowance" />
            <Field label="課税対象額計" field="taxable_amount" />
            <Field label="所得税（源泉徴収）" field="income_tax" />
            <Field label="その他支給" field="other_pay" />
          </div>
        </div>

        {/* 手取り */}
        <div className="bg-blue-50 rounded-xl px-4 py-3 flex justify-between items-center">
          <span className="text-sm font-medium text-blue-700">手取り（概算）</span>
          <span className="text-xl font-bold text-blue-700">{yen(takeHome)}</span>
        </div>

        {/* OCRが読み取った生データ（折りたたみ） */}
        {(result.raw_pays.length > 0 || result.raw_deductions.length > 0) && (
          <details className="text-xs text-gray-400">
            <summary className="cursor-pointer select-none text-gray-500 font-medium">
              解析した明細一覧を確認する
            </summary>
            <div className="mt-2 space-y-1 pl-2">
              {result.raw_pays.length > 0 && (
                <>
                  <p className="font-medium text-gray-500 mt-2">支給</p>
                  {result.raw_pays.map((p, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{p.name}</span><span>{yen(p.amount)}</span>
                    </div>
                  ))}
                </>
              )}
              {result.raw_deductions.length > 0 && (
                <>
                  <p className="font-medium text-gray-500 mt-2">控除</p>
                  {result.raw_deductions.map((d, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{d.name}</span><span>{yen(d.amount)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </details>
        )}
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
            onClick={onCancel}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "DBに保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// メインコンポーネント：画像アップロードボタン
// =============================================
interface Props {
  sources: IncomeSource[];
  onSaved: () => void;
}

export default function PayslipUploader({ sources, onSaved }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState("");

  // ファイル選択後の処理
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // inputをリセット（同じファイルを再選択できるように）
    e.target.value = "";

    setAnalyzing(true);
    setError("");
    setPreview(null);

    try {
      const formData = new FormData();
      formData.append("pdf", file);

      const res = await fetch("/api/analyze-payslip", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "解析に失敗しました");
        return;
      }

      setPreview(data as AnalyzeResult);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setAnalyzing(false);
    }
  };

  // DB保存
  const handleSave = async (form: FormData) => {
    const source = sources.find((s) => s.id === form.income_source_id);
    const res = await fetch("/api/monthly-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        income_source_id: form.income_source_id,
        income_source_name: source?.name ?? "",
        year_month: form.year_month,
        gross_amount: Number(form.gross_amount) || 0,
        transport_allowance: Number(form.transport_allowance) || 0,
        taxable_amount: Number(form.taxable_amount) || 0,
        income_tax: Number(form.income_tax) || 0,
        other_pay: Number(form.other_pay) || 0,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "保存に失敗しました");
    }

    setPreview(null);
    onSaved();
  };

  return (
    <>
      {/* 非表示のファイル入力 */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* アップロードボタン */}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={analyzing || sources.length === 0}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
      >
        {analyzing ? (
          <>
            <span className="animate-spin text-base">⏳</span>
            <span>解析中...</span>
          </>
        ) : (
          <>
            <span className="text-base">📄</span>
            <span>給与明細を読み込む</span>
          </>
        )}
      </button>

      {/* エラー表示 */}
      {error && (
        <div className="mt-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
          <div className="flex items-start justify-between gap-2">
            <span className="whitespace-pre-line leading-relaxed">{error}</span>
            <button
              onClick={() => setError("")}
              className="shrink-0 text-red-400 hover:text-red-600 mt-0.5"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 解析結果プレビュー */}
      {preview && (
        <PreviewSheet
          result={preview}
          sources={sources}
          onSave={handleSave}
          onCancel={() => setPreview(null)}
        />
      )}
    </>
  );
}
