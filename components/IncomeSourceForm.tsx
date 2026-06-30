"use client";

import { useState } from "react";
import type { IncomeSource } from "@/types/database";

interface Props {
  initial?: IncomeSource;
  onSave: () => void;
  onCancel: () => void;
}

// 収入源の追加・編集フォーム
export default function IncomeSourceForm({ initial, onSave, onCancel }: Props) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    keyword: initial?.keyword ?? "",
    calendar_id: initial?.calendar_id ?? "",
    hourly_rate: initial?.hourly_rate?.toString() ?? "",
    night_rate: initial?.night_rate?.toString() ?? "1.25",
    transport_fee: initial?.transport_fee?.toString() ?? "500",
    default_break_minutes: initial?.default_break_minutes?.toString() ?? "0",
    extra_allowance: initial?.extra_allowance?.toString() ?? "",
    deduction: initial?.deduction?.toString() ?? "",
    memo: initial?.memo ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // バリデーション
    if (!form.name.trim()) { setError("収入源名を入力してください"); return; }
    if (!form.keyword.trim()) { setError("カレンダーキーワードを入力してください"); return; }
    if (!form.hourly_rate || Number(form.hourly_rate) <= 0) { setError("基本時給を入力してください"); return; }

    setLoading(true);
    try {
      const url = initial
        ? `/api/income-sources/${initial.id}`
        : "/api/income-sources";
      const method = initial ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "保存に失敗しました");
        return;
      }

      onSave();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, key: keyof typeof form, type = "text", required = false, placeholder = "") => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {field("収入源名", "name", "text", true, "例：やよい軒")}
      {field("カレンダーキーワード", "keyword", "text", true, "例：やよい")}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          カレンダーID<span className="text-xs text-gray-400 ml-1">（設定するとそのカレンダーのみ検索）</span>
        </label>
        <input
          type="text"
          value={form.calendar_id}
          onChange={(e) => setForm((f) => ({ ...f, calendar_id: e.target.value }))}
          placeholder="例：xxx@group.calendar.google.com"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            基本時給（円）<span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="number"
            value={form.hourly_rate}
            onChange={(e) => setForm((f) => ({ ...f, hourly_rate: e.target.value }))}
            placeholder="1100"
            min="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            深夜割増率
          </label>
          <input
            type="number"
            value={form.night_rate}
            onChange={(e) => setForm((f) => ({ ...f, night_rate: e.target.value }))}
            step="0.01"
            min="1"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            交通費（円/勤務）
          </label>
          <input
            type="number"
            value={form.transport_fee}
            onChange={(e) => setForm((f) => ({ ...f, transport_fee: e.target.value }))}
            min="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            デフォルト休憩（分）
          </label>
          <input
            type="number"
            value={form.default_break_minutes}
            onChange={(e) => setForm((f) => ({ ...f, default_break_minutes: e.target.value }))}
            placeholder="0"
            min="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            その他手当（円/月）
          </label>
          <input
            type="number"
            value={form.extra_allowance}
            onChange={(e) => setForm((f) => ({ ...f, extra_allowance: e.target.value }))}
            placeholder="任意"
            min="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            天引（円/月）
          </label>
          <input
            type="number"
            value={form.deduction}
            onChange={(e) => setForm((f) => ({ ...f, deduction: e.target.value }))}
            placeholder="任意"
            min="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            個別設定（メモ）
          </label>
          <input
            type="text"
            value={form.memo}
            onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
            placeholder="任意"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "保存中..." : "保存"}
        </button>
      </div>
    </form>
  );
}
