// =============================================
// Notionから書き出した支出データをSupabaseへ取り込むスクリプト
//
// 使い方:
//   node scripts/import-expenses.mjs           … 検証のみ（ドライラン）
//   node scripts/import-expenses.mjs --apply   … 実際に投入する
//
// scripts/migration/*.json を読み込み、アプリの定義（カテゴリ・支払方法）に
// 適合するか検証したうえで expenses テーブルへ一括投入する。
// 誤って二重投入しないよう、--apply 時は既存件数を確認して警告する。
// =============================================
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const APPLY = process.argv.includes("--apply");
const MIGRATION_DIR = "scripts/migration";
const BATCH_SIZE = 100;

// アプリ側の定義（lib/expense.ts と一致させる）
const CATEGORIES = [
  "交際費", "交通費", "お菓子", "その他", "まかない",
  "娯楽費", "日用消耗品", "固定費", "食費",
];
const PAYMENT_METHODS = ["クレジットカード", "現金", "PiTaPa"];

// .env.local から値を取り出す
function readEnv(key) {
  const text = readFileSync(".env.local", "utf8");
  const m = text.match(new RegExp(`^${key}=(.+)$`, "m"));
  if (!m) throw new Error(`${key} が .env.local に見つかりません`);
  return m[1].trim();
}

const SUPABASE_URL = readEnv("SUPABASE_URL");
const SUPABASE_KEY = readEnv("SUPABASE_ANON_KEY");

// ---- 読み込み ----
const files = readdirSync(MIGRATION_DIR).filter((f) => f.endsWith(".json")).sort();
const rows = [];
for (const f of files) {
  const data = JSON.parse(readFileSync(join(MIGRATION_DIR, f), "utf8"));
  console.log(`読込 ${f}: ${data.length}件`);
  rows.push(...data);
}

// ---- 検証 ----
const errors = [];
rows.forEach((r, i) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) errors.push(`${i}: 日付が不正 (${r.date})`);
  if (!Number.isInteger(r.amount) || r.amount < 0) errors.push(`${i}: 金額が不正 (${r.amount})`);
  if (!r.item) errors.push(`${i}: 項目が空`);
  if (!CATEGORIES.includes(r.category)) errors.push(`${i}: 未知のカテゴリ (${r.category})`);
  if (!PAYMENT_METHODS.includes(r.payment_method)) errors.push(`${i}: 未知の支払方法 (${r.payment_method})`);
});

const total = rows.reduce((s, r) => s + r.amount, 0);
console.log(`\n合計 ${rows.length}件 / ${total.toLocaleString()}円`);

if (errors.length) {
  console.error(`\n検証エラー ${errors.length}件:`);
  errors.slice(0, 20).forEach((e) => console.error("  " + e));
  process.exit(1);
}
console.log("検証OK（不正な行なし）");

// 月別の内訳を出して目視確認できるようにする
const byMonth = {};
for (const r of rows) {
  const ym = r.date.slice(0, 7);
  byMonth[ym] = byMonth[ym] || { n: 0, s: 0 };
  byMonth[ym].n++;
  byMonth[ym].s += r.amount;
}
console.log("\n月別:");
for (const k of Object.keys(byMonth).sort()) {
  console.log(`  ${k}: ${byMonth[k].n}件 / ${byMonth[k].s.toLocaleString()}円`);
}

// Supabase REST を呼ぶ共通処理
async function api(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res;
}

if (!APPLY) {
  console.log("\n【ドライラン】 実際に投入するには --apply を付けて再実行してください");
  process.exit(0);
}

// ---- 二重投入の防止 ----
const head = await api("expenses?select=id", {
  method: "HEAD",
  headers: { Prefer: "count=exact" },
});
const existing = Number((head.headers.get("content-range") || "/0").split("/")[1]);
if (existing > 0) {
  console.error(`\n中止: expenses に既に ${existing} 件あります。二重投入を防ぐため実行しません。`);
  process.exit(1);
}

// ---- 投入 ----
console.log("\n投入中...");
let inserted = 0;
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  await api("expenses", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(batch),
  });
  inserted += batch.length;
  console.log(`  ${inserted} / ${rows.length}`);
}
console.log(`\n完了: ${inserted}件を投入しました`);
