"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import type {
  Expense,
  MonthlyRecord,
  ExtraIncome,
  Subscription,
  ExpenseBreakdownLine,
} from "@/types/database";
import type { SalaryBreakdown } from "@/lib/salary";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  categoryColor,
  yen,
} from "@/lib/expense";
import { markAppReady } from "@/lib/appReady";
import { payoutMonth } from "@/lib/taxYear";

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

// 内訳1行（入力中は金額も文字列で持つ）
type BreakdownLine = { title: string; amount: string };

// 入力フォームの状態
type FormState = {
  date: string;
  item: string;
  amount: string;
  category: string;
  payment_method: string;
  breakdown: BreakdownLine[];
};

// 内訳の合計（空欄は0として扱う）
function sumLines(lines: BreakdownLine[]): number {
  return lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
}

// 中身のある行が1つでもあるか
function hasLines(lines: BreakdownLine[]): boolean {
  return lines.some((l) => l.title.trim() !== "" || Number(l.amount) > 0);
}

// 入力中の内訳を保存用の形（数値）に変換する。空の行は捨てる
function toSavedLines(lines: BreakdownLine[]): ExpenseBreakdownLine[] | null {
  const out = lines
    .map((l) => ({ title: l.title.trim(), amount: Number(l.amount) || 0 }))
    .filter((l) => l.title !== "" || l.amount > 0);
  return out.length > 0 ? out : null;
}

// =============================================
// 支出の入力・編集シート
//
// 全画面シートとして、ヘッダー／入力欄／フッターを縦に固定配置する。
// 内訳（メモ欄）に行があるときは、金額をその合計で自動計算し編集不可にする。
// カテゴリが固定費のときは、登録済みの固定費・サブスクから内訳を自動で入れる。
// =============================================
function ExpenseSheet({
  initial,
  defaultDate,
  prefill,
  subscriptions,
  onClose,
  onSubmit,
  onDelete,
}: {
  initial: Expense | null;
  defaultDate: string;
  prefill?: FormState | null;
  subscriptions: Subscription[];
  onClose: () => void;
  onSubmit: (form: FormState) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => {
    if (initial) {
      return {
        date: initial.date,
        item: initial.item,
        amount: String(initial.amount),
        category: initial.category,
        payment_method: initial.payment_method,
        breakdown: (initial.breakdown ?? []).map((l) => ({
          title: l.title,
          amount: String(l.amount),
        })),
      };
    }
    return (
      prefill ?? {
        date: defaultDate,
        item: "",
        amount: "",
        category: EXPENSE_CATEGORIES[0],
        payment_method: PAYMENT_METHODS[0],
        breakdown: [],
      }
    );
  });
  const [error, setError] = useState("");

  const set = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const breakdownSum = sumLines(form.breakdown);
  const usesBreakdown = hasLines(form.breakdown);
  const effectiveAmount = usesBreakdown ? breakdownSum : Number(form.amount) || 0;

  // 登録済みの固定費・サブスクから内訳を作る
  const linesFromSubscriptions = (): BreakdownLine[] =>
    subscriptions.map((s) => ({ title: s.name, amount: String(s.amount) }));

  // カテゴリ選択。固定費を選んだとき内訳が空なら自動で埋める
  const selectCategory = (c: string) => {
    setForm((f) => {
      const next = { ...f, category: c };
      if (c === "固定費" && !hasLines(f.breakdown) && subscriptions.length > 0) {
        next.breakdown = linesFromSubscriptions();
      }
      return next;
    });
  };

  const setLine = (index: number, key: keyof BreakdownLine, value: string) =>
    setForm((f) => ({
      ...f,
      breakdown: f.breakdown.map((l, i) =>
        i === index ? { ...l, [key]: value } : l
      ),
    }));

  const addLine = () =>
    setForm((f) => ({
      ...f,
      breakdown: [...f.breakdown, { title: "", amount: "" }],
    }));

  const removeLine = (index: number) =>
    setForm((f) => ({
      ...f,
      breakdown: f.breakdown.filter((_, i) => i !== index),
    }));

  const handleSubmit = () => {
    if (!Number.isFinite(effectiveAmount) || effectiveAmount <= 0) {
      setError(
        usesBreakdown ? "内訳の金額を入力してください" : "金額を入力してください"
      );
      return;
    }
    onSubmit({ ...form, amount: String(effectiveAmount) });
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
        {/* 金額：内訳があるときは合計を自動表示する */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">金額（円）</label>
          {usesBreakdown ? (
            <>
              <div className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-3xl font-bold text-gray-900">
                {breakdownSum.toLocaleString()}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                内訳の合計です。金額を変えるには内訳を編集してください
              </p>
            </>
          ) : (
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
          )}
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

        {/* 内訳（メモ欄） */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-gray-500">
              内訳<span className="text-gray-400 ml-1">（任意）</span>
            </label>
            {usesBreakdown && (
              <span className="text-xs font-medium text-gray-600">
                合計 {yen(breakdownSum)}
              </span>
            )}
          </div>

          {form.breakdown.length > 0 && (
            <div className="space-y-2 mb-2">
              {form.breakdown.map((line, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={line.title}
                    onChange={(e) => setLine(i, "title", e.target.value)}
                    placeholder="例：通信費"
                    className="flex-1 min-w-0 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={line.amount}
                    onChange={(e) => setLine(i, "amount", e.target.value)}
                    placeholder="0"
                    className="w-24 shrink-0 border border-gray-300 rounded-xl px-2 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => removeLine(i)}
                    className="btn-press w-9 shrink-0 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100"
                    aria-label="この行を削除"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={addLine}
              className="btn3d btn3d-sm btn-soft-gray px-3 py-1.5 text-xs"
            >
              ＋ 行を追加
            </button>
            {subscriptions.length > 0 && (
              <button
                onClick={() =>
                  setForm((f) => ({ ...f, breakdown: linesFromSubscriptions() }))
                }
                className="btn3d btn3d-sm btn-soft-orange px-3 py-1.5 text-xs"
              >
                固定費から入れる
              </button>
            )}
          </div>
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
                  onClick={() => selectCategory(c)}
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
            className="w-auto max-w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  // 固定費の計上など、初期値を埋めた状態で追加シートを開くときに使う
  const [prefill, setPrefill] = useState<FormState | null>(null);
  // 給与明細（カレンダーからの見込み額）。実績が未入力の月だけ使う
  const [estimate, setEstimate] = useState<number | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);

  const fetchAll = useCallback(async (ym: string) => {
    setLoading(true);
    setError("");
    try {
      // すべて表示中の1か月分だけ取得する。並列で取得する
      // （年間DBは働いた月で記録しているので、家計簿の月とそのまま対応する）
      // サブスクは件数が少なく応答も軽いため、他と並列で取得しても遅くならない
      const [expRes, recRes, extraRes, subRes] = await Promise.all([
        fetch(`/api/expenses?month=${ym}`),
        fetch(`/api/monthly-records?month=${ym}`),
        fetch(`/api/extra-incomes?month=${ym}`),
        fetch("/api/subscriptions"),
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
      // サブスクは補助情報なので、取れなくても画面は成立させる
      if (subRes.ok) setSubscriptions(await subRes.json());
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

  // その月の給与明細の実績が入力済みか
  const hasActualIncome = useMemo(
    () => records.some((r) => r.year_month === yearMonth),
    [records, yearMonth]
  );

  // 実績が未入力の月だけ、給与明細の見込み額を後追いで取得する。
  // 初期表示をブロックしないよう、主要データの取得とは分けている
  // （カレンダーAPIはGoogleへの問い合わせが入るため遅い）
  useEffect(() => {
    if (hasActualIncome) {
      setEstimate(null);
      return;
    }
    let cancelled = false;
    setEstimateLoading(true);
    fetch(`/api/calendar?month=${yearMonth}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const total = (data.salaries ?? [])
          .filter((s: SalaryBreakdown) => s.source.is_active !== false)
          .reduce((sum: number, s: SalaryBreakdown) => sum + s.total, 0);
        setEstimate(total);
      })
      .catch(() => {
        // 見込みは補助情報のため、取得できなくても画面は成立させる
      })
      .finally(() => {
        if (!cancelled) setEstimateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [yearMonth, hasActualIncome]);

  // 月の集計（件数が少ないためクライアント側で計算し、集計用の通信は増やさない）
  const summary = useMemo(() => {
    const spent = expenses.reduce((s, e) => s + e.amount, 0);
    const extra = extraIncomes.find((e) => e.year_month === yearMonth)?.amount ?? 0;
    // 実績あり：各収入源の(支給額 − 所得税 − その他控除)
    // 実績なし：給与明細の見込み額を仮の入金額として使う
    const base = hasActualIncome
      ? records
          .filter((r) => r.year_month === yearMonth)
          .reduce(
            (s, r) => s + r.gross_amount - r.income_tax - r.other_deduction,
            0
          )
      : estimate ?? 0;
    const income = base + extra;
    return { spent, income, saving: income - spent };
  }, [expenses, records, extraIncomes, yearMonth, hasActualIncome, estimate]);

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

  // 契約中サブスクの月額合計
  const activeSubs = useMemo(
    () => subscriptions.filter((s) => s.is_active),
    [subscriptions]
  );
  const subsTotal = useMemo(
    () => activeSubs.reduce((sum, s) => sum + s.amount, 0),
    [activeSubs]
  );
  // 表示中の月に固定費が計上済みか
  const hasFixedCost = useMemo(
    () => expenses.some((e) => e.category === "固定費"),
    [expenses]
  );

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
      breakdown: toSavedLines(form.breakdown),
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

  // サブスクの月額合計を初期値として、固定費の入力シートを開く。
  // 即登録ではなくシートを挟むのは、ClaudeProのように月額が変動するものがあり
  // 計上前に金額を直せる必要があるため
  const handleAddFixedCost = () => {
    const month = Number(yearMonth.split("-")[1]);
    setPrefill({
      date: `${yearMonth}-01`,
      item: `${month}月固定費`,
      amount: String(subsTotal),
      category: "固定費",
      payment_method: "クレジットカード",
      // 何が何円かを内訳として残す
      breakdown: activeSubs.map((sub) => ({
        title: sub.name,
        amount: String(sub.amount),
      })),
    });
    setSheetOpen(true);
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
      breakdown: toSavedLines(form.breakdown),
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
          <span className="text-sm text-gray-500">
            {hasActualIncome ? "口座入金" : "口座入金（仮）"}
          </span>
          <span className="text-sm font-semibold text-gray-700">
            {!hasActualIncome && estimateLoading ? (
              <span className="text-gray-300">計算中...</span>
            ) : (
              yen(summary.income)
            )}
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
        {!hasActualIncome && (
          <p className="text-xs text-gray-400 mt-2">
            {Number(yearMonth.split("-")[1])}月分の給与明細（{payoutMonth(yearMonth)} 支給）が
            まだ未入力のため、カレンダーの勤務予定からの見込み額を仮の入金額として計算しています。
          </p>
        )}
      </div>

      {/* 追加ボタン */}
      <button
        onClick={() => {
          setPrefill(null);
          setSheetOpen(true);
        }}
        className="btn3d btn-primary w-full py-3.5 text-base mb-4"
      >
        ＋ 支出を追加
      </button>

      {/* サブスクの固定費をワンタップで計上（未計上の月だけ出す） */}
      {!loading && !hasFixedCost && subsTotal > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-900">固定費が未計上です</p>
              <p className="text-xs text-amber-700 mt-0.5">
                契約中のサブスク{activeSubs.length}件の合計
              </p>
            </div>
            <span className="text-lg font-bold text-amber-900 shrink-0">
              {yen(subsTotal)}
            </span>
          </div>
          <button
            onClick={handleAddFixedCost}
            className="btn3d btn-soft-orange w-full py-2.5 text-sm"
          >
            固定費として計上する
          </button>
          <p className="text-xs text-amber-700 mt-2 text-center">
            金額は計上前に修正できます
          </p>
        </div>
      )}

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
                        {e.breakdown && e.breakdown.length > 0
                          ? `・内訳${e.breakdown.length}件`
                          : ""}
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
          prefill={prefill}
          subscriptions={activeSubs}
          onClose={() => {
            setSheetOpen(false);
            setPrefill(null);
          }}
          onSubmit={handleCreate}
        />
      )}

      {/* 編集シート */}
      {editing && (
        <ExpenseSheet
          initial={editing}
          defaultDate={defaultDate}
          subscriptions={activeSubs}
          onClose={() => setEditing(null)}
          onSubmit={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
