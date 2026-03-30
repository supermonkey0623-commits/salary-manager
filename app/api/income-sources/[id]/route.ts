import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// 収入源更新
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const { data, error } = await supabase
    .from("income_sources")
    .update({
      name: body.name,
      keyword: body.keyword,
      hourly_rate: Number(body.hourly_rate),
      night_rate: Number(body.night_rate ?? 1.25),
      transport_fee: Number(body.transport_fee ?? 500),
      extra_allowance: body.extra_allowance ? Number(body.extra_allowance) : null,
      deduction: body.deduction ? Number(body.deduction) : null,
      memo: body.memo || null,
      default_break_minutes: Number(body.default_break_minutes ?? 0),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// 収入源削除（ソフトデリート：is_activeをFALSEに）
// 過去の月次記録は残し、収入源名のみ無効化
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { error } = await supabase
    .from("income_sources")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
