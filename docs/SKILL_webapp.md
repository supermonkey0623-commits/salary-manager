# Webアプリ開発スキルファイル
## Next.js + Google OAuth + Supabase + Vercel 構成

> 給与管理アプリ開発（2025〜2026）で得た知見をまとめたリファレンス。

---

## 1. 要件定義の進め方

### やること・やらないことを最初に決める
- 「誰が使うか」「何を解決するか」を1行で言えるレベルまで絞る
- スコープを明示的に決めないと機能が際限なく膨らむ
- 例：「個人が複数アルバイト収入を1画面で把握できるようにする」

### データ設計を先にやる
- 画面より先にテーブル設計を固める
- 後からカラムを追加・削除するコストが高い（マイグレーション管理が必要）
- 特に「削除時にどうするか」（物理削除 vs ソフトデリート）は最初に決める

### 優先順位の付け方
1. 認証（ログインできないと何もできない）
2. データの読み書き（CRUD）
3. 計算・集計ロジック
4. UI/UX改善
5. エクスポート・連携機能

### 変更コストの高い決定は早めに
- DBスキーマ（後から変えるとマイグレーションSQLが必要）
- 認証方式（後から変えると全面的な作り直し）
- URL構造（SEOや外部連携に影響）

---

## 2. 技術スタック構成

### 推奨構成（個人〜小規模Webアプリ）

```
フロントエンド  : Next.js (App Router) + TypeScript + Tailwind CSS
バックエンド    : Next.js API Routes (Vercel Functions)
データベース    : Supabase (PostgreSQL)
認証           : NextAuth.js + Google OAuth 2.0
外部API        : Google Calendar API
AI処理         : Anthropic Claude API / tesseract.js (OCR)
デプロイ        : Vercel (GitHubと連携して自動デプロイ)
```

### 各技術の役割と選定理由

| 技術 | 役割 | 選定理由 |
|---|---|---|
| Next.js App Router | UIとAPIを一体管理 | フロント/バックエンドを1リポジトリで完結 |
| TypeScript | 型安全 | バグを早期発見、補完が効く |
| Tailwind CSS | スタイリング | クラス名だけでデザインできる、モバイル対応が楽 |
| NextAuth.js | 認証管理 | Google OAuthをほぼ設定なしで使える |
| Supabase | DB+RLS | PostgreSQLをホスト不要で使える、anon keyで直接アクセス可 |
| Vercel | デプロイ | GitHubプッシュで自動デプロイ、環境変数管理が簡単 |

### ディレクトリ構成のベストプラクティス

```
app/
  (protected)/      # 認証が必要なページ群（Next.jsのルートグループ）
    layout.tsx      # 認証チェックをここに集約
  api/              # APIルート（バックエンド処理）
  login/            # 認証不要ページ
components/         # 再利用可能なUIコンポーネント
lib/                # ユーティリティ（auth.ts / supabase.ts / tax.ts など）
types/              # TypeScript型定義（database.ts）
supabase/           # SQLマイグレーションファイル（001_〜.sql）
scripts/            # セットアップ用スクリプト
docs/               # ドキュメント・スキルファイル
```

---

## 3. Google OAuth 設定の注意点

### Google Cloud Console での設定

1. **プロジェクトを必ず作成してからAPIを有効化する**
   - 先にプロジェクトを作らないとAPIが有効化できない

2. **OAuth同意画面を先に設定する**
   - 認証情報（クライアントID）より先に同意画面を設定しないとエラーになる
   - User Type は「外部」を選択（個人利用でも外部で問題ない）
   - テストユーザーに自分のGmailを追加する

3. **承認済みリダイレクトURIは開発・本番の両方を登録する**
   ```
   開発: http://localhost:3000/api/auth/callback/google
   本番: https://your-app.vercel.app/api/auth/callback/google
   ```
   - VercelのデプロイURLが確定したら**必ず追加する**（これを忘れると本番でログインできない）

4. **スコープを最小限にする**
   - Calendar読み取りのみなら `calendar.readonly` だけ追加
   - 不要なスコープはGoogleの審査対象になる

5. **テストモードのまま個人利用は可能**
   - 「テスト」ステータスのまま7日間のトークン有効期限あり（→要再ログイン）
   - 本番公開するにはGoogleの審査が必要

### NextAuth.js の設定

```typescript
// lib/auth.ts のポイント
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
          access_type: "offline",  // リフレッシュトークンを取得する場合
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      // ALLOWED_EMAIL で特定のアカウントのみ許可
      return profile?.email === process.env.ALLOWED_EMAIL;
    },
    async session({ session, token }) {
      // アクセストークンをセッションに含める（API呼び出し用）
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
};
```

### よくある認証エラーと対処

| エラー | 原因 | 対処 |
|---|---|---|
| `redirect_uri_mismatch` | リダイレクトURIが未登録 | Google Cloud ConsoleにVercelのURLを追加 |
| `access_denied` | テストユーザー未登録 | 同意画面のテストユーザーに追加 |
| `Unauthorized` 401 | セッション切れ | 再ログイン / NEXTAUTH_SECRETを確認 |
| ログインしても弾かれる | ALLOWED_EMAILの不一致 | 環境変数のメールアドレスを確認 |

---

## 4. Supabase 設定の注意点

### RLS（Row Level Security）の設定

```sql
-- 個人利用アプリはanon keyからの全操作を許可
-- 認証はNextAuth側で管理するためSupabase側では全許可でOK
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON your_table FOR ALL USING (TRUE) WITH CHECK (TRUE);
```

### TypeScript型定義とSupabase v2の互換性

**重要：** `createClient<Database>` のジェネリックに渡すカスタム型は
Supabase v2が期待する構造に完全に合わせないと `Update` 型が `never` になる。

```typescript
// NG: Relationshipsなし・スキーマにViews等がない
export type Database = {
  public: {
    Tables: { your_table: { Row: ...; Insert: ...; Update: ...; } };
  };
};

// OK: Supabase v2の期待する完全な構造
export type Database = {
  public: {
    Tables: {
      your_table: {
        Row: YourRow;
        Insert: YourInsert;
        Update: YourUpdate;
        Relationships: [];      // ← 必須
      };
    };
    Views: Record<string, never>;         // ← 必須
    Functions: Record<string, never>;     // ← 必須
    Enums: Record<string, never>;         // ← 必須
    CompositeTypes: Record<string, never>; // ← 必須
  };
};
```

### マイグレーション管理

- SQLファイルを `supabase/001_initial.sql`、`002_xxx.sql` のように連番で管理する
- 一度実行したSQLは変更しない（新しいファイルに追記する）
- `IF NOT EXISTS` / `IF EXISTS` を必ずつける（べき等性を保つ）

```sql
-- 良い書き方
ALTER TABLE monthly_records
  ADD COLUMN IF NOT EXISTS other_pay INTEGER NOT NULL DEFAULT 0;

ALTER TABLE monthly_records
  DROP COLUMN IF EXISTS old_column;
```

---

## 5. Claude Code 活用のコツ

### CLAUDE.md を必ず作る
- プロジェクトルートに `CLAUDE.md` を置くと Claude Code が毎回参照する
- ビジネスロジック・コーディングルール・環境変数名を書いておくと指示が省略できる

### 効果的な指示の出し方

```
# 良い指示の例
「annual/page.tsx の EditSheet コンポーネントに other_pay フィールドを追加してください。
 FormData 型、初期値、フォームUI、DB保存、CSVエクスポートの全てに反映してください。」

# 悪い指示の例
「その他支給を追加して」（どのファイルか、何を変えるかが不明瞭）
```

### 複数ファイルの一括変更を依頼する
- 関連するファイルをまとめて変更依頼する方が整合性が取れる
- 「A, B, C の3ファイルに同じ変更をしてください」と明示する

### エラーはスクリーンショットか全文をそのまま貼る
- 「エラーが出た」だけでは診断できない
- ビルドログ・コンソールエラー・ネットワークエラーをそのままコピペする

### 開発サーバーの再起動が必要なケース
- 環境変数（`.env.local`）を変更したとき
- `next.config.ts` を変更したとき
- 新しいパッケージを `npm install` したとき
- OCR等のネイティブモジュールの設定を変えたとき

### ポート競合の対処
```bash
# 使用中のポートを調べる
netstat -ano | findstr :3000

# プロセスを終了する（Windowsの場合）
taskkill /PID <PID番号> /F
```

---

## 6. Vercel デプロイ時のよくあるエラーと対処法

### TypeScript ビルドエラー

#### `Property 'xxx' does not exist on type 'never'`
- **原因：** Supabase の型ジェネリックが解決できず `never` になっている
- **対処：** `Database` 型を Supabase v2 の期待する構造に合わせる（上記参照）

#### `Type error: Argument of type '...' is not assignable to parameter of type 'never'`
- **原因：** 同上（`.update()` / `.insert()` の引数型が `never`）
- **対処：** `Database` 型に `Relationships`・`Views`・`Functions`・`Enums`・`CompositeTypes` を追加

#### `Property 'xxx' does not exist on type 'yyy'`
- **原因：** Supabase の `.select("*")` の戻り値が汎用型のため特定プロパティを認識しない
- **対処：** `as YourType[]` でキャスト、または型アノテーションを追加
  ```typescript
  const salaries = (sources as IncomeSource[]).map((source) => { ... });
  ```

### 環境変数エラー

#### ログインできない / 認証でリダイレクトされる
- **確認事項：**
  1. `NEXTAUTH_URL` が本番ドメインになっているか
  2. `NEXTAUTH_SECRET` が設定されているか
  3. Google Cloud Console のリダイレクトURIに本番URLを追加しているか
  4. Vercelで環境変数を追加後に **Redeploy** しているか

#### `SUPABASE_URL` / `SUPABASE_ANON_KEY` が undefined
- **原因：** VercelのEnvironment Variables未設定、またはRedeploy未実施
- **対処：** Settings > Environment Variables で確認 → Redeploy

### ビルドは成功するが動かない場合

1. Vercel の **Functions** タブでAPIのログを確認する
2. ブラウザの開発者ツールでネットワークエラーを確認する
3. `console.error` のログが Vercel のダッシュボードに出ているか確認する

### Vercel固有の制限

| 項目 | 制限値 | 対処 |
|---|---|---|
| APIタイムアウト | デフォルト10秒 | `export const maxDuration = 60;` をルートファイルに追加 |
| ファイルサイズ | 4.5MB（リクエスト） | クライアント側でバリデーション |
| 関数メモリ | 1024MB | 重い処理は分割する |

---

## 7. CLAUDE.md テンプレート

新しいプロジェクトを始めるときにこのテンプレートをコピーして使う。

```markdown
# プロジェクト概要
（アプリの目的を1〜2行で）

# 技術スタック
- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS
- Backend: Vercel Functions (Next.js API Routes)
- DB: Supabase (PostgreSQL)
- 認証: NextAuth.js + Google OAuth 2.0
- デプロイ: Vercel

# コーディングルール
- コメントは日本語で書く
- 関数には必ず型定義をつける
- エラーハンドリングは必ず実装する
- 金額計算は必ず1円未満切り捨て（Math.floor）を使う

# 重要なビジネスロジック
（ドメイン固有のルールを書く）
- 例：深夜時間帯は22:00〜翌5:00
- 例：削除時は物理削除せずis_active=falseにする

# データベース設計メモ
（主要テーブルと関係を書く）

# 環境変数（.env.localに設定）
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ALLOWED_EMAIL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=   # Claude APIを使う場合

# currentDate
Today's date is YYYY-MM-DD.
```

---

## 8. 開発フロー チェックリスト

### 新機能追加時
- [ ] DBスキーマ変更が必要か確認（必要なら `supabase/00X_xxx.sql` を作成）
- [ ] `types/database.ts` の型定義を更新
- [ ] APIルート（`app/api/xxx/route.ts`）を実装
- [ ] フロントエンドコンポーネントを実装
- [ ] TypeScriptビルドエラーがないか確認（`npx tsc --noEmit`）

### デプロイ前
- [ ] `npx tsc --noEmit` でビルドエラーなし
- [ ] `.env.local` の機密情報がコミットされていないか確認
- [ ] `node_modules/` と `.next/` が `.gitignore` に含まれているか確認
- [ ] Supabaseのマイグレーションが本番DBに適用済みか確認

### Vercel設定
- [ ] 全環境変数が登録済みか確認
- [ ] `NEXTAUTH_URL` が本番ドメインになっているか確認
- [ ] Google Cloud ConsoleにVercelのリダイレクトURIを追加済みか確認
- [ ] デプロイ後に動作確認（ログイン → 主要機能を一通り）
```
