"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import type { Expense, MonthlyRecord, ExtraIncome } from "@/types/database";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  categoryColor,
  yen,
} from "@/lib/expense";
import { markAppReady } from "@/lib/appReady";

// 月を YYYY-MM 形式にフォーマット
function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// 日付を YYYY-MM-DD 形式にフォーマット
function toDateString(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

// YYYY-MM を「YYYY年M月」に変換
function formatYearMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}年${Number(m)}月`;
}

// YYYY-MM-DD を「M/D」に変換
function shortDate(d: string): string {
  const [, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}`;
}

// 入力フォームの状態
type FormState = {
  date: string;
  item: string;
  amount: string;
  category: string;
  payment_method: string;
};

// =============================================
// 支出の入力・編集シート
//
// 全画面シートとして、ヘッダー／入力欄／フッターを縦に固定配置する。
// ・金額欄が常に最上部に見える
// ・キーボードが出ても追加ボタンがスクロール領域の外にあるため隠れない
// body直下へポータルで描画し、祖先のtransform等の影響を受けないようにする。
// =============================================
function ExpenseSheet({
  initial,
  defaultDate,
  onClose,
  onSubmit,
  onDelete,
}: {
  initial: Expense | null;
  defaultDate: string;
  onClose: () => void;
  onSubmit: (form: FormState) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    date: initial?.date ?? defaultDate,
    item: initial?.item ?? "",
    amount: initial ? String(initial.amount) : "",
    category: initial?.category ?? EXPENSE_CATEGORIES[0],
    payment_method: initial?.payment_method ?? PAYMENT_METHODS[0],
  });
  const [error, setError] = useState("");

  const set = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = () => {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("金額を入力してください");
      return;
    }
    onSubmit(form);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-white flex flex-col sheet-from-bottom"
      data-no-swipe
    >
      {/* ヘッダー（固定） */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">
          {initial ? "支出を編集" : "支出を追加"}
        </h3>
        <button
          onClick={onClose}
          className="btn-press w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100"
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>

      {/* 入力欄（ここだけスクロールする） */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* 金額：最優先で入力させる */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">金額（円）</label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
            placeholder="0"
            autoFocus={!initial}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-3xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 項目 */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">項目</label>
          <input
            type="text"
            value={form.item}
            onChange={(e) => set("item", e.target.value)}
            placeholder="例：ジュース"
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* カテゴリ：タップで選択 */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">カテゴリ</label>
          <div className="flex flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((c) => {
              const active = form.category === c;
              return (
                <button
                  key={c}
                  onClick={() => set("category", c)}
                  className="btn3d btn3d-sm px-3 py-1.5 text-xs"
                  style={
                    active
                      ? ({
                          background: categoryColor(c),
                          color: "#fff",
                          "--edge": "rgba(0,0,0,0.22)",
                        } as React.CSSProperties)
                      : ({
                          background: "#f3f4f6",
                          color: "#4b5563",
                          "--edge": "#e5e7eb",
                        } as React.CSSProperties)
                  }
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* 支払方法：タップで選択 */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">支払方法</label>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                onClick={() => set("payment_method", m)}
                className={`btn3d btn3d-sm px-3 py-1.5 text-xs ${
                  form.payment_method === m ? "btn-primary" : "btn-soft-gray"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* 日付 */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">日付</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* フッター（固定・ホームバーの余白を確保） */}
      <div className="shrink-0 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] border-t border-gray-100 bg-white">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          {initial && onDelete && (
            <button onClick={onDelete} className="btn3d btn-soft-red px-5 py-3 text-sm">
              削除
            </button>
          )}
          <button onClick={handleSubmit} className="btn3d btn-primary flex-1 py-3 text-sm">
            {initial ? "更新" : "追加"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// =============================================
// メインページ
// =============================================
export default function ExpensesPage() {
  const now = new Date();
  const [yearMonth, setYearMonth] = useState(toYearMonth(now));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [records, setRecords] = useState<MonthlyRecord[]>([]);
  const [extraIncomes, setExtraIncomes] = useState<ExtraIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const fetchAll = useCallback(async (ym: string) => {
    setLoading(true);
    setError("");
    const year = ym.split("-")[0];
    try {
      // 支出は月単位、収入系は年単位（件数が少ないため）。並列で取得する
      const [expRes, recRes, extraRes] = await Promise.all([
        fetch(`/api/expenses?month=${ym}`),
        fetch(`/api/monthly-records?year=${year}`),
        fetch(`/api/extra-incomes?year=${year}`),
      ]);

      if (expRes.status === 401) {
        window.location.href = "/login?error=SessionExpired&callbackUrl=/expenses";
        return;
      }
      if (!expRes.ok || !recRes.ok || !extraRes.ok) {
        setError("データの取得に失敗しました");
        return;
      }

      const [expData, recData, extraData] = await Promise.all([
        expRes.json(),
        recRes.json(),
        extraRes.json(),
      ]);
      setExpenses(expData);
      setRecords(recData);
      setExtraIncomes(extraData);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
      markAppReady();
    }
  }, []);

  useEffect(() => {
    fetchAll(yearMonth);
  }, [yearMonth, fetchAll]);

  // 前月・翌月へ移動
  const moveMonth = (delta: number) => {
    const [y, m] = yearMonth.split("-").map(Number);
    setYearMonth(toYearMonth(new Date(y, m - 1 + delta, 1)));
  };

  // 月の集計（件数が少ないためクライアント側で計算し、集計用の通信は増やさない）
  const summary = useMemo(() => {
    const spent = expenses.reduce((s, e) => s + e.amount, 0);
    // 口座入金額 = 各収入源の(支給額 − 所得税 − その他控除) + その他収入
    const monthRecords = records.filter((r) => r.year_month === yearMonth);
    const income =
      monthRecords.reduce(
        (s, r) => s + r.gross_amount - r.income_tax - r.other_deduction,
        0
      ) + (extraIncomes.find((e) => e.year_month === yearMonth)?.amount ?? 0);
    return { spent, income, saving: income - spent };
  }, [expenses, records, extraIncomes, yearMonth]);

  // カテゴリ別の内訳（多い順）
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return [...map.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  // 追加時の初期日付：表示中の月に今日が含まれるなら今日、そうでなければ1日
  const defaultDate =
    toYearMonth(now) === yearMonth ? toDateString(now) : `${yearMonth}-01`;

  // 追加（楽観的更新：保存を待たずに一覧へ反映する）
  const handleCreate = async (form: FormState) => {
    setSheetOpen(false);
    const temp: Expense = {
      id: `temp-${Date.now()}`,
      date: form.date,
      item: form.item.trim() || "（無題）",
      amount: Math.floor(Number(form.amount)),
      category: form.category,
      payment_method: form.payment_method,
      created_at: new Date().toISOString(),
    };
    setExpenses((prev) => [temp, ...prev]);

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const saved: Expense = await res.json();
      // 仮の行を保存結果で置き換える
      setExpenses((prev) => prev.map((e) => (e.id === temp.id ? saved : e)));
    } catch {
      // 失敗したら取り消して知らせる
      setExpenses((prev) => prev.filter((e) => e.id !== temp.id));
      setError("保存に失敗しました");
    }
  };

  // 更新（楽観的更新）
  const handleUpdate = async (form: FormState) => {
    const target = editing;
    if (!target) return;
    setEditing(null);
    const before = expenses;
    const updated: Expense = {
      ...target,
      date: form.date,
      item: form.item.trim() || "（無題）",
      amount: Math.floor(Number(form.amount)),
      category: form.category,
      payment_method: form.payment_method,
    };
    setExpenses((prev) => prev.map((e) => (e.id === target.id ? updated : e)));

    try {
      const res = await fetch(`/api/expenses/${target.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
    } catch {
      setExpenses(before);
      setError("更新に失敗しました");
    }
  };

  // 削除（楽観的更新）
  const handleDelete = async () => {
    const target = editing;
    if (!target) return;
    setEditing(null);
    const before = expenses;
    setExpenses((prev) => prev.filter((e) => e.id !== target.id));

    try {
      const res = await fetch(`/api/expenses/${target.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setExpenses(before);
      setError("削除に失敗しました");
    }
  };

  const maxCategoryAmount = byCategory[0]?.amount ?? 0;

  return (
    <div className="p-4">
      {/* ヘッダー */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
          家計簿
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

      {/* 月次サマリ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-500">口座入金</span>
          <span className="text-sm font-semibold text-gray-700">
            {yen(summary.income)}
          </span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-500">支出</span>
          <span className="text-sm font-semibold text-red-500">
            −{yen(summary.spent)}
          </span>
        </div>
        <div className="flex justify-between items-center border-t border-gray-100 pt-2">
          <span className="text-sm font-medium text-gray-700">貯蓄</span>
          <span
            className={`text-2xl font-bold ${
              summary.saving >= 0 ? "text-blue-600" : "text-red-500"
            }`}
          >
            {yen(summary.saving)}
          </span>
        </div>
      </div>

      {/* 追加ボタン */}
      <button
        onClick={() => setSheetOpen(true)}
        className="btn3d btn-primary w-full py-3.5 text-base mb-4"
      >
        ＋ 支出を追加
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-10 text-gray-400 text-sm">読み込み中...</div>
      )}

      {!loading && (
        <>
          {/* カテゴリ別内訳（追加ライブラリを使わずCSSのバーで描画） */}
          {byCategory.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
              <p className="text-xs text-gray-400 mb-3">カテゴリ別</p>
              <div className="space-y-2.5">
                {byCategory.map(({ category, amount }) => (
                  <div key={category}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">{category}</span>
                      <span className="text-gray-800 font-medium">{yen(amount)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${
                            maxCategoryAmount > 0
                              ? (amount / maxCategoryAmount) * 100
                              : 0
                          }%`,
                          backgroundColor: categoryColor(category),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 支出一覧 */}
          {expenses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <p className="text-gray-500 text-sm">
                {formatYearMonth(yearMonth)}の支出はまだありません
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="divide-y divide-gray-50">
                {expenses.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEditing(e)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-xs text-gray-400 w-10 shrink-0">
                      {shortDate(e.date)}
                    </span>
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: categoryColor(e.category) }}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-gray-800 truncate">
                        {e.item}
                      </span>
                      <span className="block text-xs text-gray-400">
                        {e.category}・{e.payment_method}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-gray-900 shrink-0">
                      {yen(e.amount)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 追加シート */}
      {sheetOpen && (
        <ExpenseSheet
          initial={null}
          defaultDate={defaultDate}
          onClose={() => setSheetOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {/* 編集シート */}
      {editing && (
        <ExpenseSheet
          initial={editing}
          defaultDate={defaultDate}
          onClose={() => setEditing(null)}
          onSubmit={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
