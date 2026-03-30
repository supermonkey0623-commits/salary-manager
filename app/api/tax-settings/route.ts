import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// 税務・控除設定を全件取得
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("tax_settings")
    .select("*")
    .order("key");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // キーでアクセスしやすいマップに変換して返す
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.key] = row.value;
  }

  return NextResponse.json(map);
}

// 税務・控除設定を一括更新
// body: { updates: { key: string; value: string }[] }
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: { key: string; value: string }[] = body.updates ?? [];

  if (updates.length === 0) {
    return NextResponse.json({ error: "更新データがありません" }, { status: 400 });
  }

  // 各キーを個別に UPDATE（既存レコードの value のみ更新。label は変更しない）
  for (const { key, value } of updates) {
    const { error } = await supabase
      .from("tax_settings")
      .update({ value })
      .eq("key", key);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
