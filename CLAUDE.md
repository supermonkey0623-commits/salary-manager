# プロジェクト概要
個人給与管理Webアプリ。複数のアルバイト収入源をGoogle Calendarと連携して管理する。

# 技術スタック
- Frontend: React + TypeScript
- Backend: Vercel Functions
- DB: Supabase
- 認証: Google OAuth 2.0
- AI: Anthropic Claude API

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
- **年月はすべて「働いた月」基準**：給与は働いた月の翌月に支給される。年間DB（monthly_records）・その他収入（extra_incomes）の `year_month` は働いた月を入れる。例：8月分は9月に給料が入ってから「8月」として入力する
- **年間合計は確定申告（暦年・支給日）ベース**：年Yの集計対象は「前年12月〜当年11月に働いた分」＝暦年Yに支給された分。範囲の算出は `lib/taxYear.ts` の `taxYearRange()` / `taxYearMonths()` を使う
- 家計簿の「口座入金」は同じ月の勤務分で対応させる（8月に働いた分は8月の支出から引く）。年間DBが働いた月基準になったことで両者が一致する

# 環境変数（.env.localに設定）
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ALLOWED_EMAIL=
ANTHROPIC_API_KEY=
MCP_API_KEY=            # MCPサーバーの認証キー（外部AIクライアントがBearerで送る）
SUPABASE_URL=
SUPABASE_ANON_KEY=
