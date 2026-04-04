import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { calcSalary } from "@/lib/salary";
import type { CalendarEvent } from "@/lib/salary";
import type { IncomeSource } from "@/types/database";

// Google Calendar APIのベースURL
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

// 全角英数字・記号を半角に正規化する（キーワードマッチの前処理）
function normalizeText(str: string): string {
  return str
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
    )
    .toLowerCase();
}

// キーワードがイベントタイトルに一致するか判定する
// 半角英数字のみのキーワード（例: "n"）は単語境界マッチ（部分一致禁止）
// 日本語を含むキーワード（例: "やよい"）は部分一致
function matchesKeyword(summary: string, keyword: string): boolean {
  const normSummary = normalizeText(summary);
  const normKeyword = normalizeText(keyword);

  // 半角英数字のみのキーワード：前後に英数字が続かない場合だけマッチ
  if (/^[a-z0-9]+$/.test(normKeyword)) {
    const regex = new RegExp(`(?<![a-z0-9])${normKeyword}(?![a-z0-9])`, "i");
    return regex.test(normSummary);
  }

  // 日本語・混合キーワード：部分一致
  return normSummary.includes(normKeyword);
}

// 指定月のカレンダーイベントを取得して給与計算を返す
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const yearMonth = searchParams.get("month"); // 例: "2024-01"

  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    return NextResponse.json({ error: "月の指定が不正です" }, { status: 400 });
  }

  const [year, month] = yearMonth.split("-").map(Number);

  // 月の開始・終了をJST（UTC+9）基準で設定する
  // Date.UTCの時間に -9 を指定することでJST 0:00 = UTC -9:00（前日15:00）を表現できる
  const timeMin = new Date(Date.UTC(year, month - 1, 1, -9, 0, 0)).toISOString();
  const timeMax = new Date(Date.UTC(year, month, 1, -9, 0, 0)).toISOString();

  // 有効な収入源を取得
  const { data: sources, error: srcError } = await supabase
    .from("income_sources")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (srcError) {
    return NextResponse.json({ error: "収入源の取得に失敗しました" }, { status: 500 });
  }

  if (!sources || sources.length === 0) {
    return NextResponse.json({ salaries: [], message: "収入源が登録されていません" });
  }

  // Google Calendar APIでイベントを取得（全カレンダー対象）
  let allEvents: CalendarEvent[] = [];
  try {
    // まずカレンダー一覧を取得
    const calListRes = await fetch(
      `${CALENDAR_API_BASE}/users/me/calendarList?maxResults=250`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    );

    if (!calListRes.ok) {
      const errText = await calListRes.text();
      console.error("CalendarList API error:", errText);
      return NextResponse.json(
        { error: "Google Calendarの取得に失敗しました。再ログインしてください。" },
        { status: 502 }
      );
    }

    const calListData = await calListRes.json();
    const calendarIds: string[] = (calListData.items ?? []).map(
      (cal: { id: string }) => cal.id
    );

    // 各カレンダーからイベントを並列取得
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "500",
    });

    const eventResults = await Promise.all(
      calendarIds.map(async (calId) => {
        try {
          const res = await fetch(
            `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calId)}/events?${params}`,
            { headers: { Authorization: `Bearer ${session.accessToken}` } }
          );
          if (!res.ok) return [];
          const data = await res.json();
          return data.items ?? [];
        } catch {
          return [];
        }
      })
    );

    // 全カレンダーのイベントを結合・重複除去
    const seen = new Set<string>();
    allEvents = eventResults.flat().reduce((acc, item: {
      id: string;
      summary?: string;
      description?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }) => {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        acc.push({
          id: item.id,
          summary: item.summary ?? "",
          description: item.description,  // 説明欄（休憩時間の記載に使用）
          start: item.start?.dateTime ?? item.start?.date ?? "",
          end: item.end?.dateTime ?? item.end?.date ?? "",
          date: item.start?.date,
        });
      }
      return acc;
    }, [] as CalendarEvent[]);

  } catch {
    return NextResponse.json(
      { error: "Google Calendarへの接続に失敗しました" },
      { status: 502 }
    );
  }

  // 収入源ごとにキーワードフィルタリング→給与計算
  const salaries = (sources as IncomeSource[]).map((source) => {
    // キーワードマッチ（半角英数字は単語境界、日本語は部分一致）
    const matched = allEvents.filter((ev) =>
      matchesKeyword(ev.summary, source.keyword)
    );
    return calcSalary(source, matched);
  });

  // 予定が1件もない場合のメッセージ
  const totalEvents = salaries.reduce((s, sal) => s + sal.events.length, 0);
  const message = totalEvents === 0
    ? `${year}年${month}月の該当予定が見つかりませんでした`
    : undefined;

  return NextResponse.json({ salaries, message });
}
