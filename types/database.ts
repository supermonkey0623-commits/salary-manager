// =============================================
// Supabase データベース型定義
// =============================================

export type Database = {
  public: {
    Tables: {
      income_sources: {
        Row: IncomeSource;
        Insert: IncomeSourceInsert;
        Update: IncomeSourceUpdate;
      };
      monthly_records: {
        Row: MonthlyRecord;
        Insert: MonthlyRecordInsert;
        Update: MonthlyRecordUpdate;
      };
      tax_settings: {
        Row: TaxSetting;
        Insert: TaxSettingInsert;
        Update: TaxSettingUpdate;
      };
    };
  };
};

// =============================================
// 収入源
// =============================================
export type IncomeSource = {
  id: string;
  name: string;              // 収入源名（表示名）
  keyword: string;           // カレンダーキーワード
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
