import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { computeSalaries } from "@/lib/payslip";

// 指定月のカレンダーイベントを取得して給与計算を返す
// 算出ロジック自体は lib/payslip.ts に置き、MCP経由の取得と共通化している
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // リフレッシュ失敗時はセッション切れとして返す
  if (session.error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "SessionExpired" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const yearMonth = searchParams.get("month"); // 例: "2024-01"

  if (!yearMonth) {
    return NextResponse.json({ error: "月の指定が不正です" }, { status: 400 });
  }

  const result = await computeSalaries(session.accessToken, yearMonth);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    salaries: result.salaries,
    message: result.message,
  });
}
