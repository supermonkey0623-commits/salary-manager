import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { IncomeSourceInsert } from "@/types/database";

// 収入源一覧取得
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("income_sources")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// 収入源新規作成
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const insert: IncomeSourceInsert = {
    name: body.name,
    keyword: body.keyword,
    calendar_id: body.calendar_id?.trim() || null,
    hourly_rate: Number(body.hourly_rate),
    night_rate: Number(body.night_rate ?? 1.25),
    transport_fee: Number(body.transport_fee ?? 500),
    extra_allowance: body.extra_allowance ? Number(body.extra_allowance) : null,
    deduction: body.deduction ? Number(body.deduction) : null,
    memo: body.memo || null,
    default_break_minutes: Number(body.default_break_minutes ?? 0),
    is_active: true,
  };

  const { data, error } = await supabase
    .from("income_sources")
    .insert(insert)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
