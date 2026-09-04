import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// 指定年のその他収入を全件取得
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");

  if (!year || !/^\d{4}$/.test(year)) {
    return NextResponse.json({ error: "年の指定が不正です" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("extra_incomes")
    .select("*")
    .gte("year_month", `${year}-01`)
    .lte("year_month", `${year}-12`)
    .order("year_month", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

// その他収入を保存（year_month で upsert）
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (!body.year_month || !/^\d{4}-\d{2}$/.test(body.year_month)) {
    return NextResponse.json({ error: "年月の指定が不正です" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("extra_incomes")
    .upsert(
      {
        year_month: body.year_month,
        amount: Number(body.amount) || 0,
        memo: body.memo?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "year_month" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
