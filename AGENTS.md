# プロジェクト概要
個人給与管理Webアプリ。複数のアルバイト収入源をGoogle Calendarと連携して管理する。

# 技術スタック
- Frontend: React + TypeScript
- Backend: Vercel Functions
- DB: Supabase
- 認証: Google OAuth 2.0
- AI: Anthropic Codex API

# コーディングルール
- コメントは日本語で書く
- 関数には必ず型定義をつける
- エラーハンドリングは必ず実装する
- 金額計算は必ず1円未満切り捨て（Math.floor）を使う

# 重要なビジネスロジック
- 深夜時間帯：22:00〜翌5:00
- 交通費：1勤務500円固定、同日複数収入源は各自カウント
- 休日手当は存在しない
- 収入源削除時は過去データを残し収入源名のみ無効化

# 環境変数（.env.localに設定）
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ALLOWED_EMAIL=
ANTHROPIC_API_KEY=
MCP_API_KEY=            # MCPサーバーの認証キー（外部AIクライアントがBearerで送る）
SUPABASE_URL=
SUPABASE_ANON_KEY=
