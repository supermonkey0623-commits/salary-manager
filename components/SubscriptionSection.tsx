"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Subscription } from "@/types/database";
import { formatRenewal, daysUntilRenewal } from "@/lib/subscription";

// 更新日がこの日数以内に迫ったら強調する（解約判断の猶予を持たせるため）
const SOON_DAYS = 7;

function yen(n: number): string {
  return `¥${Math.floor(n).toLocaleString()}`;
}

type FormState = {
  name: string;
  amount: string;
  renewal_day: string;
  cancel_note: string;
  memo: string;
  is_active: boolean;
};

// =============================================
// サブスクの追加・編集シート
// =============================================
function SubscriptionSheet({
  initial,
  onClose,
  onSaved,
}: {
  initial: Subscription | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    name: initial?.name ?? "",
    amount: initial ? String(initial.amount) : "",
    renewal_day: initial ? String(initial.renewal_day) : "1",
    cancel_note: initial?.cancel_note ?? "",
    memo: initial?.memo ?? "",
    is_active: initial?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setError("");
    if (!form.name.trim()) {
      setError("サービス名を入力してください");
      return;
    }
    const day = Number(form.renewal_day);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      setError("更新日は1〜31で指定してください");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        initial ? `/api/subscriptions/${initial.id}` : "/api/subscriptions",
        {
          method: initial ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
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

  const handleDelete = async () => {
    if (!initial) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/subscriptions/${initial.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("削除に失敗しました");
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

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-white flex flex-col sheet-from-bottom"
      data-no-swipe
    >
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">
          {initial ? "サブスクを編集" : "サブスクを追加"}
        </h3>
        <button
          onClick={onClose}
          className="btn-press w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100"
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">サービス名</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="例：チョコザップ"
            autoFocus={!initial}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">月額（円）</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="0"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">更新日（毎月）</label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="31"
              value={form.renewal_day}
              onChange={(e) => set("renewal_day", e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">
            解約ルール<span className="text-gray-400 ml-1">（任意）</span>
          </label>
          <input
            type="text"
            value={form.cancel_note}
            onChange={(e) => set("cancel_note", e.target.value)}
            placeholder="例：前月10日までに申請"
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">
            メモ<span className="text-gray-400 ml-1">（任意）</span>
          </label>
          <input
            type="text"
            value={form.memo}
            onChange={(e) => set("memo", e.target.value)}
            placeholder="例：支払い月＝翌月の利用分"
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">契約状態</label>
          <div className="flex gap-2">
            <button
              onClick={() => set("is_active", true)}
              className={`btn3d btn3d-sm px-4 py-2 text-sm ${
                form.is_active ? "btn-success" : "btn-soft-gray"
              }`}
            >
              契約中
            </button>
            <button
              onClick={() => set("is_active", false)}
              className={`btn3d btn3d-sm px-4 py-2 text-sm ${
                !form.is_active ? "btn-primary" : "btn-soft-gray"
              }`}
            >
              解約済み
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            解約済みにすると月額合計から外れます（記録は残ります）
          </p>
        </div>
      </div>

      <div className="shrink-0 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] border-t border-gray-100 bg-white">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          {initial && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="btn3d btn-soft-red px-5 py-3 text-sm"
            >
              削除
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn3d btn-primary flex-1 py-3 text-sm"
          >
            {saving ? "保存中..." : initial ? "更新" : "追加"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// =============================================
// サブスク一覧（設定画面のセクション）
// =============================================
export default function SubscriptionSection() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/subscriptions");
      if (res.ok) setSubs(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubs();
  }, [fetchSubs]);

  const active = subs.filter((s) => s.is_active);
  const cancelled = subs.filter((s) => !s.is_active);
  const monthlyTotal = active.reduce((s, x) => s + x.amount, 0);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
          固定費・サブスク
        </h2>
        <button
          onClick={() => setSheetOpen(true)}
          className="btn3d btn3d-sm btn-soft-blue px-3 py-1.5 text-sm"
        >
          ＋ 追加
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-4 text-center">読み込み中...</p>
      ) : subs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-500 mb-3">固定費が登録されていません</p>
          <button
            onClick={() => setSheetOpen(true)}
            className="btn3d btn-primary px-5 py-2.5 text-sm"
          >
            最初の固定費を追加する
          </button>
        </div>
      ) : (
        <>
          {/* 月額合計 */}
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-2 flex justify-between items-center">
            <span className="text-sm text-gray-600">
              有効 {active.length}件の月額合計
            </span>
            <span className="text-lg font-bold text-blue-600">{yen(monthlyTotal)}</span>
          </div>

          <div className="space-y-2">
            {active.map((s) => {
              const days = daysUntilRenewal(s.renewal_day);
              const soon = days <= SOON_DAYS;
              return (
                <button
                  key={s.id}
                  onClick={() => setEditing(s)}
                  className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{s.name}</p>
                      <p
                        className={`text-xs mt-0.5 ${
                          soon ? "text-amber-600 font-medium" : "text-gray-500"
                        }`}
                      >
                        次回更新 {formatRenewal(s.renewal_day)}
                      </p>
                      {s.cancel_note && (
                        <p
                          className={`text-xs mt-1 rounded-lg px-2 py-1 inline-block ${
                            soon
                              ? "bg-amber-50 text-amber-700"
                              : "bg-gray-50 text-gray-500"
                          }`}
                        >
                          解約：{s.cancel_note}
                        </p>
                      )}
                      {s.memo && (
                        <p className="text-xs text-gray-400 mt-1">{s.memo}</p>
                      )}
                    </div>
                    <span className="font-semibold text-gray-900 shrink-0">
                      {yen(s.amount)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 解約済み */}
          {cancelled.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 mb-2">解約済み（{cancelled.length}件）</p>
              <div className="space-y-2">
                {cancelled.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setEditing(s)}
                    className="w-full text-left bg-white rounded-xl border border-gray-100 p-3 opacity-60 hover:opacity-80 transition-opacity"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 truncate">{s.name}</span>
                      <span className="text-sm text-gray-500 shrink-0">{yen(s.amount)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {sheetOpen && (
        <SubscriptionSheet
          initial={null}
          onClose={() => setSheetOpen(false)}
          onSaved={fetchSubs}
        />
      )}
      {editing && (
        <SubscriptionSheet
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={fetchSubs}
        />
      )}
    </div>
  );
}
