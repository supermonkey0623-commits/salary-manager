import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Supabase接続確認用エンドポイント
export async function GET() {
  const { data, error } = await supabase
    .from("tax_settings")
    .select("key, value, label")
    .limit(3);

  if (error) {
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "ok", sample: data });
}
