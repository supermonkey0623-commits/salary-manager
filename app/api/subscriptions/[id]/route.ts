import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// サブスクを更新
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  if (!String(body.name ?? "").trim()) {
    return NextResponse.json({ error: "サービス名を入力してください" }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "月額が不正です" }, { status: 400 });
  }
  const day = Number(body.renewal_day);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return NextResponse.json({ error: "更新日は1〜31で指定してください" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      name: String(body.name).trim(),
      amount: Math.floor(amount),
      renewal_day: day,
      cancel_note: String(body.cancel_note ?? "").trim() || null,
      memo: String(body.memo ?? "").trim() || null,
      is_active: body.is_active !== false,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// サブスクを削除（履歴を残す必要がないため物理削除）
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { error } = await supabase.from("subscriptions").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
