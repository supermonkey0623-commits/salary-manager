// =============================================
// 税金・控除の計算ユーティリティ
// =============================================

// 給与所得控除を計算する（2020年以降の改正版）
export function calcSalaryDeduction(annualIncome: number): number {
  if (annualIncome <= 1625000) return 550000;
  if (annualIncome <= 1800000) return Math.floor(annualIncome * 0.4) - 100000;
  if (annualIncome <= 3600000) return Math.floor(annualIncome * 0.3) + 80000;
  if (annualIncome <= 6600000) return Math.floor(annualIncome * 0.2) + 440000;
  if (annualIncome <= 8500000) return Math.floor(annualIncome * 0.1) + 1100000;
  return 1950000;
}

// 所得税を計算する（超過累進課税・復興特別所得税を除く）
export function calcIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  if (taxableIncome <= 1950000) return Math.floor(taxableIncome * 0.05);
  if (taxableIncome <= 3300000) return Math.floor(taxableIncome * 0.10) - 97500;
  if (taxableIncome <= 6950000) return Math.floor(taxableIncome * 0.20) - 427500;
  if (taxableIncome <= 9000000) return Math.floor(taxableIncome * 0.23) - 636000;
  if (taxableIncome <= 18000000) return Math.floor(taxableIncome * 0.33) - 1536000;
  if (taxableIncome <= 40000000) return Math.floor(taxableIncome * 0.40) - 2796000;
  return Math.floor(taxableIncome * 0.45) - 4796000;
}

// 住民税を計算する（概算：所得割10% + 均等割5,000円）
export function calcResidentTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  return Math.floor(taxableIncome * 0.10) + 5000;
}
