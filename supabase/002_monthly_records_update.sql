-- monthly_records テーブルの項目変更
-- 削除：health_insurance, pension, employment_insurance, resident_tax, other_deduction
-- 追加：transport_allowance（通勤手当）, taxable_amount（課税対象額計）

ALTER TABLE monthly_records
  ADD COLUMN IF NOT EXISTS transport_allowance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxable_amount      INTEGER NOT NULL DEFAULT 0;

ALTER TABLE monthly_records
  DROP COLUMN IF EXISTS health_insurance,
  DROP COLUMN IF EXISTS pension,
  DROP COLUMN IF EXISTS employment_insurance,
  DROP COLUMN IF EXISTS resident_tax,
  DROP COLUMN IF EXISTS other_deduction;
