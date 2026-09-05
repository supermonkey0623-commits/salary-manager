import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// 入力値の検証（新規・更新で共通）
function validate(body: Record<string, unknown>): string | null {
  if (!String(body.name ?? "").trim()) return "サービス名を入力してください";
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) return "月額が不正です";
  const day = Number(body.renewal_day);
  if (!Number.isInteger(day) || day < 1 || day > 31) return "更新日は1〜31で指定してください";
  return null;
}

// 保存する形に整える
function toRow(body: Record<string, unknown>) {
  return {
    name: String(body.name).trim(),
    amount: Math.floor(Number(body.amount)),
    renewal_day: Number(body.renewal_day),
    cancel_note: String(body.cancel_note ?? "").trim() || null,
    memo: String(body.memo ?? "").trim() || null,
    is_active: body.is_active !== false,
  };
}

// サブスク一覧（解約済みも含めて返し、表示側で分ける）
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .order("is_active", { ascending: false })
    .order("amount", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

// サブスクを新規登録
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const invalid = validate(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const { data, error } = await supabase
    .from("subscriptions")
    .insert(toRow(body))
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
