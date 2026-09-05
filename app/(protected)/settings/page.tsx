"use client";

import { useEffect, useState, useCallback } from "react";
import { signOut } from "next-auth/react";
import IncomeSourceForm from "@/components/IncomeSourceForm";
import SubscriptionSection from "@/components/SubscriptionSection";
import type { IncomeSource, Subscription, Expense } from "@/types/database";
import { yen } from "@/lib/expense";
import { markAppReady } from "@/lib/appReady";

// 設定は「一覧（親）→ 各詳細（子）」の2階層で切り替える。
// ルートを増やさず内部の状態で切り替えることで、遷移のたびの再読み込みを避けている
type View = "menu" | "sources" | "subscriptions";
type Mode = "list" | "add" | "edit";

// 今日の年月（YYYY-MM）
function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// =============================================
// メイン設定ページ
// =============================================
export default function SettingsPage() {
  const [view, setView] = useState<View>("menu");

  // 収入源
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [mode, setMode] = useState<Mode>("list");
  const [editing, setEditing] = useState<IncomeSource | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IncomeSource | null>(null);

  // 固定費・サブスク
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  const [loading, setLoading] = useState(true);
  // 家計簿への計上結果を伝えるメッセージ
  const [postMessage, setPostMessage] = useState("");
  const [posting, setPosting] = useState(false);

  // 収入源とサブスクをまとめて取得する（親で一度だけ取り、子には渡す）
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [srcRes, subRes] = await Promise.all([
        fetch("/api/income-sources"),
        fetch("/api/subscriptions"),
      ]);
      if (srcRes.ok) setSources(await srcRes.json());
      if (subRes.ok) setSubscriptions(await subRes.json());
    } finally {
      setLoading(false);
      markAppReady();
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // 収入源の保存後は一覧へ戻る
  const handleSave = () => {
    setMode("list");
    setEditing(null);
    fetchAll();
  };

  // 収入源のソフトデリート
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/income-sources/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setDeleteTarget(null);
      fetchAll();
    }
  };

  const activeSources = sources.filter((s) => s.is_active);
  const activeSubs = subscriptions.filter((s) => s.is_active);
  const subsTotal = activeSubs.reduce((sum, s) => sum + s.amount, 0);

  // 登録済みの固定費を、今月の家計簿へ計上する
  const handlePostFixedCost = async () => {
    setPosting(true);
    setPostMessage("");
    try {
      if (activeSubs.length === 0) {
        setPostMessage("固定費が登録されていません");
        return;
      }
      const ym = currentYearMonth();
      const month = Number(ym.split("-")[1]);

      // 二重計上を防ぐため、その月に固定費があるか先に確認する
      const check = await fetch(`/api/expenses?month=${ym}`);
      if (check.ok) {
        const list: Expense[] = await check.json();
        if (list.some((e) => e.category === "固定費")) {
          setPostMessage(`${month}月はすでに計上済みです`);
          return;
        }
      }

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: `${ym}-01`,
          item: `${month}月固定費`,
          amount: subsTotal,
          category: "固定費",
          payment_method: "クレジットカード",
          // 何が何円かを内訳として残す
          breakdown: activeSubs.map((s) => ({ title: s.name, amount: s.amount })),
        }),
      });
      if (!res.ok) {
        setPostMessage("計上に失敗しました");
        return;
      }
      setPostMessage(`${month}月の家計簿に ${yen(subsTotal)} を計上しました`);
    } catch {
      setPostMessage("通信エラーが発生しました");
    } finally {
      setPosting(false);
    }
  };

  // 子ページ共通のヘッダー（戻る矢印つき）
  const ChildHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-3 mb-6">
      <button
        onClick={() => {
          setView("menu");
          setMode("list");
          setEditing(null);
        }}
        className="btn-press w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 text-lg"
        aria-label="戻る"
      >
        ←
      </button>
      <h1 className="text-lg font-bold">{title}</h1>
    </div>
  );

  // ==================== 収入源フォーム（子のさらに中） ====================
  if (view === "sources" && (mode === "add" || mode === "edit")) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => {
              setMode("list");
              setEditing(null);
            }}
            className="btn-press w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 text-lg"
            aria-label="戻る"
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
          onCancel={() => {
            setMode("list");
            setEditing(null);
          }}
        />
      </div>
    );
  }

  // ==================== 収入源（子ページ） ====================
  if (view === "sources") {
    return (
      <div className="p-4">
        <ChildHeader title="収入源" />

        <div className="flex items-center justify-end mb-3">
          <button
            onClick={() => setMode("add")}
            className="btn3d btn3d-sm btn-soft-blue px-3 py-1.5 text-sm"
          >
            ＋ 収入源を追加
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-4 text-center">読み込み中...</p>
        ) : sources.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-500 mb-3">収入源が登録されていません</p>
            <button
              onClick={() => setMode("add")}
              className="btn3d btn-primary px-5 py-2.5 text-sm"
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
                      キーワード：{src.keyword}　時給：¥
                      {src.hourly_rate.toLocaleString()}
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
                    <div className="flex gap-2 ml-3 shrink-0">
                      <button
                        onClick={() => {
                          setEditing(src);
                          setMode("edit");
                        }}
                        className="btn3d btn3d-sm btn-soft-blue px-3 py-1.5 text-xs"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => setDeleteTarget(src)}
                        className="btn3d btn3d-sm btn-soft-red px-3 py-1.5 text-xs"
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

        {/* 削除確認モーダル */}
        {deleteTarget && (
          <div
            className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4 overlay-fade-in"
            data-no-swipe
          >
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 sheet-from-bottom">
              <h3 className="font-bold text-gray-900 mb-2">収入源を削除しますか？</h3>
              <p className="text-sm text-gray-500 mb-1">
                「{deleteTarget.name}」を無効化します。
              </p>
              <p className="text-sm text-gray-400 mb-6">過去の記録データは残ります。</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="btn3d btn-neutral flex-1 py-3 text-sm"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDelete}
                  className="btn3d btn-danger flex-1 py-3 text-sm"
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

  // ==================== 固定費・サブスク（子ページ） ====================
  if (view === "subscriptions") {
    return (
      <div className="p-4">
        <ChildHeader title="固定費・サブスク" />
        <SubscriptionSection
          subscriptions={subscriptions}
          loading={loading}
          onChanged={fetchAll}
        />
      </div>
    );
  }

  // ==================== 一覧（親ページ） ====================
  return (
    <div className="p-4">
      <h1 className="text-lg font-bold mb-4">設定</h1>

      <div className="space-y-3">
        {/* 収入源 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setView("sources")}
              className="btn-press flex-1 min-w-0 text-left"
            >
              <p className="font-medium text-gray-900">収入源</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {loading ? "読み込み中..." : `有効 ${activeSources.length}件`}
              </p>
            </button>
            <button
              onClick={() => setView("sources")}
              className="btn3d btn3d-sm btn-soft-blue px-3 py-1.5 text-xs shrink-0"
            >
              編集
            </button>
          </div>
        </div>

        {/* 固定費・サブスク */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setView("subscriptions")}
              className="btn-press flex-1 min-w-0 text-left"
            >
              <p className="font-medium text-gray-900">固定費・サブスク</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {loading
                  ? "読み込み中..."
                  : `有効 ${activeSubs.length}件 / 月額 ${yen(subsTotal)}`}
              </p>
            </button>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setView("subscriptions")}
                className="btn3d btn3d-sm btn-soft-blue px-3 py-1.5 text-xs"
              >
                編集
              </button>
              <button
                onClick={handlePostFixedCost}
                disabled={posting}
                className="btn3d btn3d-sm btn-soft-orange px-3 py-1.5 text-xs"
              >
                {posting ? "計上中..." : "追加"}
              </button>
            </div>
          </div>

          {/* 計上ボタンの結果 */}
          {postMessage && (
            <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mt-3">
              {postMessage}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            「追加」で今月の家計簿に固定費を計上します（内訳つき）
          </p>
        </div>
      </div>

      {/* ==================== ログアウト ==================== */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="btn3d btn-soft-red w-full py-3 text-sm"
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}
