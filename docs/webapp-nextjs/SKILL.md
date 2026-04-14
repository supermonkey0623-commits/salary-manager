---
name: webapp-nextjs
description: |
  Next.js + Supabase + Vercel + Google OAuth 構成のWebアプリ開発に関する知見・手順・エラー対処をまとめたスキル。
  次のような場面では必ずこのスキルを参照すること：
  - Next.js App Router でWebアプリを新規作成・設計するとき
  - Google OAuth（NextAuth.js）の設定・トラブルシュートをするとき
  - Supabase のテーブル設計・マイグレーション・TypeScript型定義をするとき
  - Vercel へのデプロイ、環境変数の設定、ビルドエラーの修正をするとき
  - CLAUDE.md を作成・更新するとき
  - 「ログインできない」「型エラーが出る」「デプロイが失敗する」などのトラブルが起きたとき
---

# Next.js + Google OAuth + Supabase + Vercel 開発スキル

個人〜小規模Webアプリ開発の実践知見。このスタックでアプリを作るときに最初に参照する。

---

## 推奨技術スタック

```
フロントエンド : Next.js (App Router) + TypeScript + Tailwind CSS
バックエンド   : Next.js API Routes (Vercel Functions)
データベース   : Supabase (PostgreSQL)
認証          : NextAuth.js + Google OAuth 2.0
デプロイ       : Vercel（GitHubと連携して自動デプロイ）
```

### ディレクトリ構成

```
app/
  (protected)/      # 認証必須ページ群（ルートグループ）
    layout.tsx      # 認証チェックをここに集約
  api/              # APIルート
  login/            # 認証不要ページ
components/         # 再利用コンポーネント
lib/                # auth.ts / supabase.ts / その他ユーティリティ
types/              # database.ts（型定義）
supabase/           # 001_initial.sql, 002_xxx.sql...（連番管理）
```

---

## 要件定義の進め方

1. 「誰が・何を解決するか」を1行で言えるまで絞る
2. **DBスキーマを画面より先に設計する**（後から変えるコストが高い）
3. 削除方針を最初に決める（物理削除 vs `is_active=false` のソフトデリート）
4. 実装優先順位：認証 → CRUD → 計算ロジック → UI改善 → エクスポート

---

## Google OAuth 設定

### Google Cloud Console の手順（この順番を守る）

1. プロジェクト作成
2. **OAuth同意画面**を先に設定（これをしないと認証情報が作れない）
   - User Type：外部（個人利用でも外部でOK）
   - テストユーザーに自分のGmailを追加
   - スコープは必要最小限のみ（例：`calendar.readonly`）
3. **認証情報 → OAuth 2.0 クライアントID** を作成
   - 承認済みリダイレクトURIに開発・本番の両方を登録：
     ```
     http://localhost:3000/api/auth/callback/google
     https://your-app.vercel.app/api/auth/callback/google
     ```
   - ⚠️ Vercelデプロイ後にURLが確定したら必ず本番URLを追加する

### NextAuth.js 設定のポイント

```typescript
// lib/auth.ts
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      // 特定アカウントのみ許可
      return profile?.email === process.env.ALLOWED_EMAIL;
    },
    async session({ session, token }) {
      // Google APIを呼ぶためアクセストークンをセッションに含める
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
};
```

### 認証エラーの対処

| エラー | 原因 | 対処 |
|---|---|---|
| `redirect_uri_mismatch` | リダイレクトURI未登録 | Google Cloud ConsoleにVercel URLを追加 |
| `access_denied` | テストユーザー未登録 | 同意画面のテストユーザーに追加 |
| 401 Unauthorized | セッション切れ | 再ログイン / `NEXTAUTH_SECRET` を確認 |
| ログインしても弾かれる | `ALLOWED_EMAIL` の不一致 | 環境変数のメールアドレスを確認 |

---

## Supabase 設定

### RLS（Row Level Security）

個人利用アプリはNextAuth側で認証を管理するため、Supabase側は全許可でOK：

```sql
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON your_table FOR ALL USING (TRUE) WITH CHECK (TRUE);
```

### ⚠️ Supabase v2 TypeScript型定義の落とし穴

`createClient<Database>` に渡すカスタム型が不完全だと `.update()` の型が `never` になりビルドエラーになる。

**NG（よくある間違い）：**
```typescript
export type Database = {
  public: {
    Tables: {
      your_table: { Row: ...; Insert: ...; Update: ...; }
      // Relationships がない → never になる
    };
    // Views / Functions / Enums / CompositeTypes がない → never になる
  };
};
```

**OK（正しい構造）：**
```typescript
export type Database = {
  public: {
    Tables: {
      your_table: {
        Row: YourRow;
        Insert: YourInsert;
        Update: YourUpdate;
        Relationships: [];             // ← 必須
      };
    };
    Views: Record<string, never>;          // ← 必須
    Functions: Record<string, never>;      // ← 必須
    Enums: Record<string, never>;          // ← 必須
    CompositeTypes: Record<string, never>; // ← 必須
  };
};
```

### マイグレーション管理

- `supabase/001_initial.sql`, `002_xxx.sql` と連番で管理
- 一度実行したSQLは変更しない（新ファイルに追記）
- `IF NOT EXISTS` / `IF EXISTS` を必ずつけてべき等にする

```sql
ALTER TABLE records ADD COLUMN IF NOT EXISTS new_col INTEGER NOT NULL DEFAULT 0;
ALTER TABLE records DROP COLUMN IF EXISTS old_col;
```

---

## Vercel デプロイ

### 環境変数一覧

| 変数名 | 説明 | 取得元 |
|---|---|---|
| `GOOGLE_CLIENT_ID` | OAuthクライアントID | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuthシークレット | Google Cloud Console |
| `ALLOWED_EMAIL` | アクセス許可するGmailアドレス | — |
| `NEXTAUTH_SECRET` | 署名用シークレット | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | 本番ドメイン（例: `https://xxx.vercel.app`） | Vercelデプロイ後に確定 |
| `SUPABASE_URL` | SupabaseプロジェクトURL | Supabase > Settings > API |
| `SUPABASE_ANON_KEY` | Supabase匿名キー | Supabase > Settings > API |
| `ANTHROPIC_API_KEY` | Claude APIキー | console.anthropic.com |

### デプロイ手順

1. GitHub にプッシュ
2. [vercel.com/new](https://vercel.com/new) でリポジトリをインポート
3. 上記の環境変数を全て設定
4. Deploy を実行
5. 発行されたURLを Google Cloud Console のリダイレクトURIに追加
6. `NEXTAUTH_URL` を確定ドメインに更新して **Redeploy**

### よくあるビルドエラーと対処

#### `Property 'xxx' does not exist on type 'never'`
- Supabase `Database` 型の構造不備 → 上記の「OK構造」に修正

#### `Argument of type '...' is not assignable to parameter of type 'never'`
- 同上（`.update()` / `.insert()` の引数型が `never`）

#### `Property 'keyword' does not exist on type 'n'`
- Supabase `.select("*")` の戻り値が汎用型のため型を認識しない
- 修正方法：型アサーションを追加
  ```typescript
  (sources as IncomeSource[]).map((source) => { ... })
  ```

### Vercel の制限値

| 項目 | デフォルト | 対処 |
|---|---|---|
| APIタイムアウト | 10秒 | `export const maxDuration = 60;` をルートに追加 |
| リクエストサイズ | 4.5MB | クライアント側でバリデーション |

---

## デプロイ前チェックリスト

- [ ] `npx tsc --noEmit` でTypeScriptエラーなし
- [ ] `.env.local` が `.gitignore` に含まれている
- [ ] Supabaseマイグレーションが本番DBに適用済み
- [ ] Vercelに全環境変数を設定し Redeploy 済み
- [ ] Google Cloud Console のリダイレクトURIに本番URLを追加済み

---

## CLAUDE.md テンプレート

新プロジェクト開始時にコピーして使う：

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
（ドメイン固有のルールをここに書く）

# 環境変数（.env.localに設定）
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ALLOWED_EMAIL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=

# currentDate
Today's date is YYYY-MM-DD.
```

---

## Claude Code 活用のコツ

- **具体的に指示する**：「どのファイルの」「どのコンポーネントに」「何を追加するか」を明示
- **関連ファイルをまとめて依頼する**：型定義・API・UIコンポーネントを1回の指示で変更依頼すると整合性が保てる
- **エラーはそのまま貼る**：「エラーが出た」だけでなくビルドログ・スタックトレースを全文コピペする
- **開発サーバー再起動が必要なケース**：`.env.local` 変更 / `next.config.ts` 変更 / `npm install` 後
- **ポート競合（Windows）**：`taskkill /PID <PID> /F` で既存プロセスを終了してから `npm run dev`
