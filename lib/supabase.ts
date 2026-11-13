import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Supabaseクライアントのシングルトン（サーバー専用）
// アクセスはすべて app/api/* と lib/* のサーバー側から行うため、
// RLSを通らない secret key（service_role）を使う。
// "server-only" により、ブラウザ側のコードから import するとビルドエラーになる
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 鍵の設定漏れに起動時に気付けるようにする
if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
  // サーバーではログイン状態を保持しない（Supabase Authは使っていない）
  auth: { persistSession: false, autoRefreshToken: false },
});