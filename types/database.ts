// =============================================
// Supabase データベース型定義
// =============================================

// Supabase v2 の createClient<Database> ジェネリックが期待する構造に合わせる
// 各テーブルに Relationships を追加し、スキーマに Views / Functions / Enums / CompositeTypes を追加
export type Database = {
  public: {
    Tables: {
      income_sources: {
        Row: IncomeSource;
        Insert: IncomeSourceInsert;
        Update: IncomeSourceUpdate;
        Relationships: [];
      };
      monthly_records: {
        Row: MonthlyRecord;
        Insert: MonthlyRecordInsert;
        Update: MonthlyRecordUpdate;
        Relationships: [];
      };
      tax_settings: {
        Row: TaxSetting;
        Insert: TaxSettingInsert;
        Update: TaxSettingUpdate;
        Relationships: [];
      };
      google_tokens: {
        Row: GoogleToken;
        Insert: GoogleTokenInsert;
        Update: GoogleTokenUpdate;
        Relationships: [];
      };
      extra_incomes: {
        Row: ExtraIncome;
        Insert: ExtraIncomeInsert;
        Update: ExtraIncomeUpdate;
        Relationships: [];
      };
      expenses: {
        Row: Expense;
        Insert: ExpenseInsert;
        Update: ExpenseUpdate;
        Relationships: [];
      };
      subscriptions: {
        Row: Subscription;
        Insert: SubscriptionInsert;
        Update: SubscriptionUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// =============================================
// 収入源
// =============================================
export type IncomeSource = {
  id: string;
  name: string;              // 収入源名（表示名）
  keyword: string;           // カレンダーキーワード
  calendar_id: string | null; // Google カレンダーID（設定時はそのカレンダーのみ検索）
  hourly_rate: number;       // 基本時給（円）
  night_rate: number;        // 深夜割増率（例: 1.25）
  transport_fee: number;     // 交通費（1勤務あたり円）
  extra_allowance: number | null; // その他手当
  deduction: number | null;       // 天引
  memo: string | null;            // 個別設定
  default_break_minutes: number;  // デフォルト休憩時間（分）
  is_active: boolean;        // 有効フラグ
  created_at: string;
};

export type IncomeSourceInsert = Omit<IncomeSource, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type IncomeSourceUpdate = Partial<IncomeSourceInsert>;

// =============================================
// Googleリフレッシュトークン（再ログイン時の復元用）
// =============================================
export type GoogleToken = {
  email: string;         // 対象アカウントのメールアドレス
  refresh_token: string; // Googleリフレッシュトークン
  updated_at: string;    // 最終更新日時
};

export type GoogleTokenInsert = Omit<GoogleToken, "updated_at"> & {
  updated_at?: string;
};

export type GoogleTokenUpdate = Partial<GoogleTokenInsert>;

// =============================================
// その他収入（タイミー等の臨時収入・年月ごと）
// =============================================
export type ExtraIncome = {
  year_month: string;    // 対象年月（例: "2026-03"）
  amount: number;        // その他収入の金額（円）
  memo: string | null;   // メモ（任意）
  updated_at: string;    // 最終更新日時
};

export type ExtraIncomeInsert = Omit<ExtraIncome, "updated_at"> & {
  updated_at?: string;
};

export type ExtraIncomeUpdate = Partial<ExtraIncomeInsert>;

// =============================================
// 支出（家計簿）
// =============================================
// 支出の内訳1行（メモ欄）
export type ExpenseBreakdownLine = {
  title: string;   // 何に使ったか
  amount: number;  // いくらか（円）
};

export type Expense = {
  id: string;
  date: string;            // 日付（YYYY-MM-DD）
  item: string;            // 項目（自由入力）
  amount: number;          // 値段（円）※内訳がある場合はその合計
  category: string;        // カテゴリ
  payment_method: string;  // 支払方法
  breakdown: ExpenseBreakdownLine[] | null; // 内訳（任意）
  created_at: string;
};

export type ExpenseInsert = Omit<Expense, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type ExpenseUpdate = Partial<ExpenseInsert>;

// =============================================
// サブスク（固定費の内訳）
// =============================================
export type Subscription = {
  id: string;
  name: string;              // サービス名
  amount: number;            // 月額（円）
  renewal_day: number;       // 更新日（毎月何日か）
  cancel_note: string | null; // 解約ルール
  memo: string | null;        // メモ
  is_active: boolean;         // 解約済みはfalse
  created_at: string;
};

export type SubscriptionInsert = Omit<Subscription, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type SubscriptionUpdate = Partial<SubscriptionInsert>;

// =============================================
// 月次記録
// =============================================
export type MonthlyRecord = {
  id: string;
  income_source_id: string | null; // 削除済み収入源はnull
  income_source_name: string;      // 収入源名（削除後も保持）
  year_month: string;              // 対象年月（例: "2024-01"）
  gross_amount: number;            // 支給額合計（税引前・通勤手当含む）
  transport_allowance: number;     // 通勤手当
  taxable_amount: number;          // 課税対象額計
  income_tax: number;              // 所得税（源泉徴収）
  other_deduction: number;         // その他控除（雇用保険・社会保険料など）
  other_pay: number;               // その他支給
  created_at: string;
  updated_at: string;
};

export type MonthlyRecordInsert = Omit<MonthlyRecord, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type MonthlyRecordUpdate = Partial<MonthlyRecordInsert>;

// =============================================
// 税務・控除設定
// =============================================
export type TaxSetting = {
  id: string;
  key: string;    // 設定キー
  value: string;  // 設定値（数値も文字列）
  label: string;  // 表示名
  updated_at: string;
};

export type TaxSettingInsert = Omit<TaxSetting, "id" | "updated_at"> & {
  id?: string;
  updated_at?: string;
};

export type TaxSettingUpdate = Partial<TaxSettingInsert>;

// =============================================
// 税務設定キーの定数
// =============================================
export const TAX_SETTING_KEYS = {
  WALL_103: "wall_103",
  WALL_106: "wall_106",
  WALL_130: "wall_130",
  BASIC_DEDUCTION: "basic_deduction",
  SALARY_DEDUCTION_MIN: "salary_deduction_min",
  SALARY_DEDUCTION_RATE: "salary_deduction_rate",
  HEALTH_INSURANCE_RATE: "health_insurance_rate",
  PENSION_RATE: "pension_rate",
  EMPLOYMENT_INSURANCE_RATE: "employment_insurance_rate",
} as const;

export type TaxSettingKey = typeof TAX_SETTING_KEYS[keyof typeof TAX_SETTING_KEYS];

// =============================================
// 補助型：税務設定をキーでアクセスできるマップ
// =============================================
export type TaxSettingMap = Record<TaxSettingKey, number>;
