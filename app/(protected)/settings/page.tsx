"use client";

import { useEffect, useState, useCallback } from "react";
import { signOut } from "next-auth/react";
import IncomeSourceForm from "@/components/IncomeSourceForm";
import type { IncomeSource } from "@/types/database";

type Mode = "list" | "add" | "edit";

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
            className="btn3d btn3d-sm btn-soft-blue px-3 py-1.5 text-sm"
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
                    <div className="flex gap-2 ml-3 shrink-0">
                      <button
                        onClick={() => { setEditing(src); setMode("edit"); }}
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

      {/* ==================== 削除確認モーダル ==================== */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4 overlay-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 sheet-from-bottom">
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
