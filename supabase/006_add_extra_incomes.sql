-- =============================================
-- その他収入（タイミー等の臨時収入）テーブル
-- 年月ごとに1件、金額とメモを保持し年間集計の合計に加算する
-- =============================================
CREATE TABLE IF NOT EXISTS extra_incomes (
  year_month TEXT PRIMARY KEY,                     -- 対象年月（例: "2026-03"）
  amount     INTEGER NOT NULL DEFAULT 0,           -- その他収入の金額（円）
  memo       TEXT,                                 -- メモ（任意・例: タイミー）
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()    -- 最終更新日時
);
