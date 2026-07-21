-- =============================================
-- Googleリフレッシュトークンの永続化テーブル
-- Googleは初回同意時にしかリフレッシュトークンを返さないため、
-- 再ログイン後もDBから復元できるように保存しておく
-- =============================================
CREATE TABLE IF NOT EXISTS google_tokens (
  email         TEXT PRIMARY KEY,                  -- 対象アカウントのメールアドレス
  refresh_token TEXT NOT NULL,                     -- Googleリフレッシュトークン
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() -- 最終更新日時
);
