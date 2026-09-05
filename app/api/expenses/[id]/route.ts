import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { normalizeBreakdown, breakdownTotal } from "@/lib/expense";

// 支出を更新
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: "日付の指定が不正です" }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "金額の指定が不正です" }, { status: 400 });
  }

  // 内訳がある場合は金額をその合計で上書きし、両者がずれないようにする
  const breakdown = normalizeBreakdown(body.breakdown);
  const finalAmount = breakdown ? breakdownTotal(breakdown) : Math.floor(amount);

  const { data, error } = await supabase
    .from("expenses")
    .update({
      date: body.date,
      item: String(body.item ?? "").trim() || "（無題）",
      amount: finalAmount,
      category: body.category,
      payment_method: body.payment_method,
      breakdown,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// 支出を削除（家計簿は履歴を残す必要がないため物理削除）
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { error } = await supabase.from("expenses").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
