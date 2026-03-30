-- =============================================
-- 給与管理アプリ 初期テーブル設計
-- Supabase SQL Editor で実行してください
-- =============================================

-- =============================================
-- 1. 収入源テーブル
-- =============================================
CREATE TABLE IF NOT EXISTS income_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,                    -- 収入源名（表示名）
  keyword       TEXT NOT NULL,                    -- カレンダーキーワード
  hourly_rate   INTEGER NOT NULL,                 -- 基本時給（円）
  night_rate    NUMERIC(4,2) NOT NULL DEFAULT 1.25, -- 深夜割増率（デフォルト1.25）
  transport_fee INTEGER NOT NULL DEFAULT 500,     -- 交通費（1勤務あたり円）
  extra_allowance INTEGER,                        -- その他手当（任意）
  deduction     INTEGER,                          -- 天引（任意）
  memo          TEXT,                             -- 個別設定（任意）
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,    -- 有効フラグ（削除時はFALSEに）
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 2. 月次記録テーブル
-- =============================================
CREATE TABLE IF NOT EXISTS monthly_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  income_source_id      UUID REFERENCES income_sources(id) ON DELETE SET NULL,
  income_source_name    TEXT NOT NULL,            -- 収入源名（削除後も残す）
  year_month            TEXT NOT NULL,            -- 対象年月（例: "2024-01"）
  gross_amount          INTEGER NOT NULL DEFAULT 0, -- 支給額合計（税引前）
  health_insurance      INTEGER NOT NULL DEFAULT 0, -- 健康保険料
  pension               INTEGER NOT NULL DEFAULT 0, -- 厚生年金
  employment_insurance  INTEGER NOT NULL DEFAULT 0, -- 雇用保険
  income_tax            INTEGER NOT NULL DEFAULT 0, -- 所得税（源泉徴収）
  resident_tax          INTEGER NOT NULL DEFAULT 0, -- 住民税
  other_deduction       INTEGER NOT NULL DEFAULT 0, -- その他控除
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 同じ収入源・年月の組み合わせは1件のみ
  UNIQUE (income_source_id, year_month)
);

-- updated_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER monthly_records_updated_at
  BEFORE UPDATE ON monthly_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 3. 税務・控除設定テーブル
-- =============================================
CREATE TABLE IF NOT EXISTS tax_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,   -- 設定キー
  value       TEXT NOT NULL,          -- 設定値（数値も文字列で保存）
  label       TEXT NOT NULL,          -- 表示名
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tax_settings_updated_at
  BEFORE UPDATE ON tax_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 4. 税務設定の初期データ
-- =============================================
INSERT INTO tax_settings (key, value, label) VALUES
  ('wall_103',                 '1030000',  '103万の壁'),
  ('wall_106',                 '1060000',  '106万の壁'),
  ('wall_130',                 '1300000',  '130万の壁'),
  ('basic_deduction',          '480000',   '基礎控除額'),
  ('salary_deduction_min',     '550000',   '給与所得控除（最低額）'),
  ('salary_deduction_rate',    '0.40',     '給与所得控除率（162.5万以下）'),
  ('health_insurance_rate',    '0.0500',   '健康保険料率（本人負担分）'),
  ('pension_rate',             '0.0915',   '厚生年金料率（本人負担分）'),
  ('employment_insurance_rate','0.0060',   '雇用保険料率（本人負担分）')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- 5. RLS（Row Level Security）設定
-- 個人利用アプリのためサーバーサイドからのみアクセス
-- =============================================
ALTER TABLE income_sources   ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_settings     ENABLE ROW LEVEL SECURITY;

-- anon キーからの全操作を許可（認証はNextAuth側で管理）
CREATE POLICY "allow_all_income_sources"  ON income_sources  FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "allow_all_monthly_records" ON monthly_records FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "allow_all_tax_settings"    ON tax_settings    FOR ALL USING (TRUE) WITH CHECK (TRUE);
