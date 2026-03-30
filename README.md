# 給与管理アプリ

個人が複数のアルバイト収入源を管理するWebアプリ。Google Calendarと連携して勤務時間を自動取得し、給与計算・年間収入管理・収入の壁チェック・給与明細OCR読み込みを行う。

## 機能

- **勤怠管理** — Google Calendarの予定から勤務時間を自動集計（深夜割増・交通費計算対応）
- **給与明細OCR** — 給与明細の画像/PDFをアップロードして支給額を自動読み取り
- **年間収入DB** — 月次の支給額・所得税などを記録・編集
- **収入の壁チェック** — 103万・106万・130万の壁をリアルタイムで確認
- **CSVエクスポート** — Notion互換フォーマットで月次明細・年間集計をエクスポート

## 技術スタック

| 分類 | 技術 |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind CSS |
| Backend | Vercel Functions (Next.js API Routes) |
| DB | Supabase (PostgreSQL) |
| 認証 | NextAuth.js + Google OAuth 2.0 |
| OCR | tesseract.js (日本語) + pdf-parse |
| グラフ | Recharts |

---

## セットアップ手順

### 1. リポジトリのクローンと依存関係インストール

```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
npm install
```

### 2. Tesseract 日本語データのダウンロード（初回のみ）

```bash
npm run setup:tessdata
```

`.cache/tesseract/jpn.traineddata` に日本語学習データがダウンロードされます。

---

## 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成し、各値を設定してください。

```bash
cp .env.local.example .env.local
```

| 変数名 | 説明 | 取得元 |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuthクライアントID | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuthクライアントシークレット | Google Cloud Console |
| `ALLOWED_EMAIL` | アクセスを許可するGmailアドレス（自分のアドレス） | — |
| `NEXTAUTH_SECRET` | NextAuth.js署名用シークレット | `openssl rand -base64 32` で生成 |
| `NEXTAUTH_URL` | アプリのベースURL | 開発: `http://localhost:3000` / 本番: Vercelドメイン |
| `SUPABASE_URL` | SupabaseプロジェクトURL | Supabase > Project Settings > API |
| `SUPABASE_ANON_KEY` | Supabase匿名キー | Supabase > Project Settings > API |
| `ANTHROPIC_API_KEY` | Claude APIキー（OCR解析用） | [console.anthropic.com](https://console.anthropic.com) |

---

## Google Cloud Console の設定

### プロジェクト作成

1. [Google Cloud Console](https://console.cloud.google.com) にアクセス
2. 上部のプロジェクト選択 → **新しいプロジェクト** を作成

### APIの有効化

1. **APIとサービス > ライブラリ** を開く
2. 以下を検索して有効化：
   - **Google Calendar API**

### OAuth 2.0 クライアントIDの作成

1. **APIとサービス > 認証情報** → **認証情報を作成 > OAuth クライアントID**
2. 以下を設定：
   - アプリケーションの種類：**ウェブアプリケーション**
   - 承認済みの JavaScript 生成元：
     - `http://localhost:3000`（開発用）
     - `https://your-app.vercel.app`（本番用）
   - 承認済みのリダイレクトURI：
     - `http://localhost:3000/api/auth/callback/google`（開発用）
     - `https://your-app.vercel.app/api/auth/callback/google`（本番用）
3. 作成後に表示される **クライアントID** と **クライアントシークレット** を `.env.local` に設定

### OAuth同意画面の設定

1. **APIとサービス > OAuth同意画面** を開く
2. User Type：**外部**（個人利用の場合も外部を選択）
3. アプリ名・メールアドレスを入力
4. スコープに以下を追加：
   - `https://www.googleapis.com/auth/calendar.readonly`
5. テストユーザーに自分のGmailアドレスを追加

> **注意：** 本番公開する場合はGoogleの審査が必要です。個人利用のみなら「テスト」ステータスのまま使用できます。

---

## Supabase の設定

### プロジェクト作成

1. [Supabase](https://supabase.com) にアクセスしてアカウント作成
2. **New Project** からプロジェクトを作成（リージョン：Northeast Asia / Tokyo 推奨）
3. **Project Settings > API** から以下を取得して `.env.local` に設定：
   - **Project URL** → `SUPABASE_URL`
   - **anon public** キー → `SUPABASE_ANON_KEY`

### マイグレーションの実行

**SQL Editor**（左サイドバー）を開き、以下のSQLファイルを順番に実行してください。

#### ① 初期テーブル作成（`supabase/001_initial.sql`）

```sql
-- supabase/001_initial.sql の内容をコピーして実行
```

テーブルが作成されます：
- `income_sources` — 収入源マスタ
- `monthly_records` — 月次給与記録
- `tax_settings` — 税務設定（103万の壁など）

#### ② カラム変更（`supabase/002_monthly_records_update.sql`）

```sql
ALTER TABLE monthly_records
  ADD COLUMN IF NOT EXISTS transport_allowance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxable_amount      INTEGER NOT NULL DEFAULT 0;

ALTER TABLE monthly_records
  DROP COLUMN IF EXISTS health_insurance,
  DROP COLUMN IF EXISTS pension,
  DROP COLUMN IF EXISTS employment_insurance,
  DROP COLUMN IF EXISTS resident_tax,
  DROP COLUMN IF EXISTS other_deduction;
```

#### ③ その他支給カラム追加（`supabase/003_add_other_pay.sql`）

```sql
ALTER TABLE monthly_records
  ADD COLUMN IF NOT EXISTS other_pay INTEGER NOT NULL DEFAULT 0;
```

---

## NEXTAUTH_SECRET の生成

```bash
openssl rand -base64 32
```

生成した値を `.env.local` の `NEXTAUTH_SECRET` に設定してください。
（Windowsの場合は [Git Bash](https://gitforwindows.org/) または WSL を使用）

---

## 開発サーバーの起動

```bash
npm run dev
```

`http://localhost:3000` にアクセス。

---

## Vercel へのデプロイ

### 事前準備

- GitHubにリポジトリをプッシュ済みであること
- [Vercel](https://vercel.com) アカウント作成済みであること

### 手順

#### 1. Vercel でプロジェクトをインポート

1. [vercel.com/new](https://vercel.com/new) を開く
2. **Import Git Repository** から対象のGitHubリポジトリを選択
3. **Framework Preset** が `Next.js` になっていることを確認

#### 2. 環境変数を設定

**Environment Variables** セクションに以下を追加：

| 変数名 | 値 |
|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud ConsoleのクライアントID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Consoleのクライアントシークレット |
| `ALLOWED_EMAIL` | 自分のGmailアドレス |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` で生成した値 |
| `NEXTAUTH_URL` | `https://your-app.vercel.app`（デプロイ後に確定するドメイン） |
| `SUPABASE_URL` | SupabaseのProject URL |
| `SUPABASE_ANON_KEY` | Supabaseのanon key |
| `ANTHROPIC_API_KEY` | AnthropicのAPIキー |

> **注意：** `NEXTAUTH_URL` はVercelが自動付与するドメイン（`https://xxx.vercel.app`）を使用してください。カスタムドメインを設定した場合はそちらに変更します。

#### 3. デプロイ実行

**Deploy** ボタンをクリック。初回ビルドが完了するとURLが発行されます。

#### 4. Google Cloud Console にリダイレクトURIを追加

Vercelのデプロイ後、発行されたドメインを Google Cloud Console の **承認済みリダイレクトURI** に追加します：

```
https://your-app.vercel.app/api/auth/callback/google
```

#### 5. Vercel の NEXTAUTH_URL を更新

確定したドメインで `NEXTAUTH_URL` を更新し、**Redeploy** を実行してください。

### 継続的デプロイ

`main` ブランチへのプッシュで自動的にデプロイされます。

---

## プロジェクト構成

```
.
├── app/
│   ├── (protected)/        # 認証必須ページ
│   │   ├── annual/         # 年間収入DB
│   │   ├── calendar/       # 勤怠カレンダー
│   │   └── settings/       # 収入源設定
│   ├── api/                # APIルート
│   │   ├── analyze-payslip/  # 給与明細OCR解析
│   │   ├── monthly-records/  # 月次記録CRUD
│   │   └── income-sources/   # 収入源CRUD
│   └── login/              # ログインページ
├── components/             # 共通コンポーネント
├── lib/                    # ユーティリティ（認証・Supabase・税計算）
├── types/                  # TypeScript型定義
├── supabase/               # SQLマイグレーションファイル
└── scripts/                # セットアップスクリプト
```

---

## ビジネスロジック仕様

| 項目 | 仕様 |
|---|---|
| 深夜時間帯 | 22:00〜翌5:00（割増率は収入源ごとに設定） |
| 交通費 | 1勤務500円固定（収入源ごとに変更可） |
| 手取り計算 | 支給額合計 − 所得税（源泉徴収） |
| 収入源削除 | 過去データを保持し収入源名のみ無効化 |
| 金額計算 | 1円未満切り捨て（Math.floor） |
