-- =============================================
-- monthly_records に other_deduction（その他控除）を追加
-- 所得税以外の控除（雇用保険・社会保険料など）を記録し、
-- 口座入金額 = 支給額合計 -（所得税 + その他控除）を算出できるようにする
-- =============================================
ALTER TABLE monthly_records
  ADD COLUMN IF NOT EXISTS other_deduction INTEGER NOT NULL DEFAULT 0;
