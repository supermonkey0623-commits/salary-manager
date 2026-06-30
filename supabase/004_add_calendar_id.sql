-- 収入源テーブルにカレンダーIDカラムを追加
-- calendar_id: Google カレンダーの ID（例: xxx@group.calendar.google.com）
-- NULL の場合はキーワードのみで全カレンダーを検索（後方互換）
ALTER TABLE income_sources
  ADD COLUMN IF NOT EXISTS calendar_id TEXT;
