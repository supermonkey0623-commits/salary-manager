"use client";

import { useEffect, useState, useCallback } from "react";
import { signOut } from "next-auth/react";
import IncomeSourceForm from "@/components/IncomeSourceForm";
import type { IncomeSource } from "@/types/database";

type Mode = "list" | "add" | "edit";

// =============================================
// 税務設定の項目定義
// =============================================
type TaxField = {
  key: string;
  label: string;
  description: string;
  unit: "yen" | "percent";
};

// グループ別に定義
const TAX_GROUPS: { title: string; fields: TaxField[] }[] = [
  {
    title: "収入の壁（閾値）",
    fields: [
      { key: "wall_103", label: "", description: "所得税・扶養控除の影響が出る年収（103万円）", unit: "yen" },
      { key: "wall_106", label: "", description: "社会保険加入義務が生じる年収（106万円）", unit: "yen" },
      { key: "wall_130", label: "", description: "健康保険の扶養から外れる年収（130万円）", unit: "yen" },
    ],
  },
  {
    title: "控除額",
    fields: [
      { key: "basic_deduction", label: "基礎控除額", description: "所得計算時に差し引く基礎控除", unit: "yen" },
      { key: "salary_deduction_min", label: "給与所得控除（最低額）", description: "年収162.5万以下に適用する最低控除額", unit: "yen" },
      { key: "salary_deduction_rate", label: "給与所得控除率", description: "年収162.5万以下に適用する控除率", unit: "percent" },
    ],
  },
  {
    title: "社会保険料率（本人負担分）",
    fields: [
      { key: "health_insurance_rate", label: "健康保険料率", description: "月額報酬に対する健康保険の本人負担率", unit: "percent" },
      { key: "pension_rate", label: "厚生年金料率", description: "月額報酬に対する厚生年金の本人負担率", unit: "percent" },
      { key: "employment_insurance_rate", label: "雇用保険料率", description: "賃金に対する雇用保険の本人負担率", unit: "percent" },
    ],
  },
];

// =============================================
// 税務設定セクション
// =============================================
function TaxSettingsSection() {
  // フォーム値（画面表示用：yenはそのまま、percentは×100して%表示）
  const [form, setForm] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // 設定を取得
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tax-settings");
      if (!res.ok) return;
      const data: Record<string, string> = await res.json();

      // percent 系は表示のため × 100 しておく
      const display: Record<string, string> = {};
      for (const group of TAX_GROUPS) {
        for (const field of group.fields) {
          const raw = data[field.key] ?? "";
          display[field.key] =
            field.unit === "percent"
              ? String(Math.round(Number(raw) * 10000) / 100) // 0.0500 → 5.00
              : raw;
        }
      }
      setForm(display);
      setOriginal(display);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // 変更があるかチェック
  const isDirty = Object.keys(form).some((k) => form[k] !== original[k]);

  // 保存
  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);

    // percent 系は DB 保存前に ÷ 100
    const updates = TAX_GROUPS.flatMap((g) =>
      g.fields.map((f) => ({
        key: f.key,
        value:
          f.unit === "percent"
            ? String(Math.round((Number(form[f.key]) / 100) * 1000000) / 1000000)
            : String(Math.floor(Number(form[f.key]))),
      }))
    );

    try {
      const res = await fetch("/api/tax-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "保存に失敗しました");
        return;
      }

      setOriginal({ ...form });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-400 py-4 text-center">読み込み中...</p>;
  }

  return (
    <div className="space-y-4">
      {TAX_GROUPS.map((group) => (
        <div
          key={group.title}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
        >
          {/* グループタイトル */}
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {group.title}
            </h3>
          </div>

          {/* フィールド一覧 */}
          <div className="divide-y divide-gray-50">
            {group.fields.map((field) => (
              <div key={field.key} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {field.label && (
                      <p className="text-sm font-medium text-gray-800">{field.label}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">{field.description}</p>
                  </div>

                  {/* 入力 */}
                  <div className="flex items-center gap-1 shrink-0">
                    {field.unit === "yen" && (
                      <span className="text-xs text-gray-400">¥</span>
                    )}
                    <input
                      type="number"
                      inputMode="decimal"
                      value={form[field.key] ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [field.key]: e.target.value }))
                      }
                      step={field.unit === "percent" ? "0.01" : "1"}
                      min="0"
                      className="w-24 text-right border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {field.unit === "percent" && (
                      <span className="text-xs text-gray-400">%</span>
                    )}
                    {field.unit === "yen" && (
                      <span className="text-xs text-gray-400">円</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* エラー */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* 保存ボタン */}
      <button
        onClick={handleSave}
        disabled={saving || !isDirty}
        className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
      >
        {saving ? "保存中..." : saved ? "✓ 保存しました" : "税務設定を保存"}
      </button>

      {saved && (
        <p className="text-xs text-green-600 text-center">
          設定を保存しました。年間DB・壁アラートに反映されます。
        </p>
      )}
    </div>
  );
}

// =============================================
// メイン設定ページ
// =============================================
export default function SettingsPage() {
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [mode, setMode] = useState<Mode>("list");
  const [editing, setEditing] = useState<IncomeSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<IncomeSource | null>(null);

  // 収入源一覧を取得
  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/income-sources");
      if (res.ok) {
        setSources(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // 保存後にリストへ戻る
  const handleSave = () => {
    setMode("list");
    setEditing(null);
    fetchSources();
  };

  // ソフトデリート実行
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/income-sources/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setDeleteTarget(null);
      fetchSources();
    }
  };

  // 収入源フォーム表示中
  if (mode === "add" || mode === "edit") {
    return (
      <div className="p-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => { setMode("list"); setEditing(null); }}
            className="text-gray-500 hover:text-gray-700 text-lg"
          >
            ←
          </button>
          <h1 className="text-lg font-bold">
            {mode === "add" ? "収入源を追加" : "収入源を編集"}
          </h1>
        </div>
        <IncomeSourceForm
          initial={editing ?? undefined}
          onSave={handleSave}
          onCancel={() => { setMode("list"); setEditing(null); }}
        />
      </div>
    );
  }

  // 一覧表示
  return (
    <div className="p-4 pb-24">
      <h1 className="text-lg font-bold mb-4">設定</h1>

      {/* ==================== 収入源セクション ==================== */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            収入源
          </h2>
          <button
            onClick={() => setMode("add")}
            className="text-sm text-blue-600 font-medium hover:text-blue-700"
          >
            ＋ 追加
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-4 text-center">読み込み中...</p>
        ) : sources.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-500 mb-3">収入源が登録されていません</p>
            <button
              onClick={() => setMode("add")}
              className="text-sm text-blue-600 font-medium"
            >
              最初の収入源を追加する
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map((src) => (
              <div
                key={src.id}
                className={`bg-white rounded-xl border p-4 ${
                  src.is_active ? "border-gray-200" : "border-gray-100 opacity-50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">
                        {src.name}
                      </span>
                      {!src.is_active && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          無効化済み
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      キーワード：{src.keyword}　時給：¥{src.hourly_rate.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      交通費：¥{src.transport_fee}/回　深夜割増：×{src.night_rate}
                      {src.default_break_minutes > 0
                        ? `　休憩：${src.default_break_minutes}分`
                        : ""}
                      {src.extra_allowance
                        ? `　手当：¥${src.extra_allowance.toLocaleString()}`
                        : ""}
                      {src.deduction
                        ? `　天引：¥${src.deduction.toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  {src.is_active && (
                    <div className="flex gap-3 ml-3 shrink-0">
                      <button
                        onClick={() => { setEditing(src); setMode("edit"); }}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => setDeleteTarget(src)}
                        className="text-sm text-red-500 hover:text-red-600"
                      >
                        削除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================== 税務・控除設定セクション ==================== */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            税務・控除設定
          </h2>
        </div>
        <TaxSettingsSection />
      </div>

      {/* ==================== ログアウト ==================== */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full py-2.5 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
        >
          ログアウト
        </button>
      </div>

      {/* ==================== 削除確認モーダル ==================== */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 mb-2">収入源を削除しますか？</h3>
            <p className="text-sm text-gray-500 mb-1">
              「{deleteTarget.name}」を無効化します。
            </p>
            <p className="text-sm text-gray-400 mb-6">
              過去の記録データは残ります。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
