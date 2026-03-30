-- monthly_records テーブルに other_pay（その他支給）を追加
ALTER TABLE monthly_records
  ADD COLUMN IF NOT EXISTS other_pay INTEGER NOT NULL DEFAULT 0;
