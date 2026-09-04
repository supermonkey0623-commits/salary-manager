import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// 指定年の月次記録を全件取得
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");

  if (!year || !/^\d{4}$/.test(year)) {
    return NextResponse.json({ error: "年の指定が不正です" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("monthly_records")
    .select("*")
    .gte("year_month", `${year}-01`)
    .lte("year_month", `${year}-12`)
    .order("year_month", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

// 月次記録を保存（income_source_id + year_month で upsert）
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (!body.income_source_id || !body.year_month) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("monthly_records")
    .upsert(
      {
        income_source_id: body.income_source_id,
        income_source_name: body.income_source_name,
        year_month: body.year_month,
        gross_amount: Number(body.gross_amount) || 0,
        transport_allowance: Number(body.transport_allowance) || 0,
        taxable_amount: Number(body.taxable_amount) || 0,
        income_tax: Number(body.income_tax) || 0,
        other_deduction: Number(body.other_deduction) || 0,
        other_pay: Number(body.other_pay) || 0,
      },
      { onConflict: "income_source_id,year_month" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
