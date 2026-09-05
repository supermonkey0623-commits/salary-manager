-- =============================================
-- 支出テーブル（家計簿）
-- Notionの「支出2026DB」をアプリへ移行したもの
-- 月関数・月支出合計などの数式列は日付から算出できるため持たない
-- =============================================
CREATE TABLE IF NOT EXISTS expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date           DATE NOT NULL,       -- 日付
  item           TEXT NOT NULL,       -- 項目（自由入力）
  amount         INTEGER NOT NULL,    -- 値段（円）
  category       TEXT NOT NULL,       -- カテゴリ
  payment_method TEXT NOT NULL,       -- 支払方法
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 月での絞り込みが主な検索軸のため日付にインデックスを張る
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date DESC);
