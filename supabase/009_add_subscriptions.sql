-- =============================================
-- サブスク管理テーブル
-- Notionの「サブスク関連　管理」ページをアプリへ移行したもの
-- 月額と更新日に加え、解約期限のルールを文章で保持する
-- （チョコザップの「前月10日までに申請」のように条件が一律でないため）
-- =============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,        -- サービス名
  amount       INTEGER NOT NULL,     -- 月額（円）
  renewal_day  INTEGER NOT NULL,     -- 更新日（毎月何日か）
  cancel_note  TEXT,                 -- 解約ルール（任意）
  memo         TEXT,                 -- メモ（任意）
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,  -- 解約済みはFALSE
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscriptions_renewal_day_range CHECK (renewal_day BETWEEN 1 AND 31),
  CONSTRAINT subscriptions_amount_positive CHECK (amount >= 0)
);
