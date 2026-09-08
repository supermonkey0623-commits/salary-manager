import { supabase } from "@/lib/supabase";
import { calcSalary } from "@/lib/salary";
import type { CalendarEvent, SalaryBreakdown } from "@/lib/salary";
import type { IncomeSource } from "@/types/database";

// =============================================
// 給与見込みの算出（Googleカレンダー由来）
//
// 画面用のAPI（/api/calendar）と外部連携用のMCPの両方から使うため、
// ロジックをここに集約している。呼び出し側はアクセストークンの
// 入手方法だけが異なる（画面はセッション、MCPは保存済みリフレッシュトークン）。
// =============================================

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

// 全角英数字を半角に正規化する（キーワードマッチの前処理）
function normalizeText(str: string): string {
  return str
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    )
    .toLowerCase();
}

// キーワードがイベントタイトルに一致するか判定する
// 半角英数字のみのキーワード（例: "n"）は単語境界マッチ（部分一致禁止）
// 日本語を含むキーワード（例: "やよい"）は部分一致
export function matchesKeyword(summary: string, keyword: string): boolean {
  const normSummary = normalizeText(summary);
  const normKeyword = normalizeText(keyword);

  if (/^[a-z0-9]+$/.test(normKeyword)) {
    const regex = new RegExp(`(?<![a-z0-9])${normKeyword}(?![a-z0-9])`, "i");
    return regex.test(normSummary);
  }
  return normSummary.includes(normKeyword);
}

export type ComputeSalariesResult =
  | { ok: true; salaries: SalaryBreakdown[]; message?: string }
  | { ok: false; error: string; status: number };

// 指定月の給与見込みを収入源ごとに算出する
export async function computeSalaries(
  accessToken: string,
  yearMonth: string
): Promise<ComputeSalariesResult> {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    return { ok: false, error: "月の指定が不正です", status: 400 };
  }

  const [year, month] = yearMonth.split("-").map(Number);

  // 月の開始・終了をJST（UTC+9）基準で設定する
  // Date.UTCの時間に -9 を指定することでJST 0:00 = UTC -9:00（前日15:00）を表現できる
  const timeMin = new Date(Date.UTC(year, month - 1, 1, -9, 0, 0)).toISOString();
  const timeMax = new Date(Date.UTC(year, month, 1, -9, 0, 0)).toISOString();

  const { data: sources, error: srcError } = await supabase
    .from("income_sources")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (srcError) {
    return { ok: false, error: "収入源の取得に失敗しました", status: 500 };
  }
  if (!sources || sources.length === 0) {
    return { ok: true, salaries: [], message: "収入源が登録されていません" };
  }

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "500",
  });

  // イベントを1カレンダーから取得する
  async function fetchEvents(calId: string): Promise<CalendarEvent[]> {
    try {
      const res = await fetch(
        `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calId)}/events?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.items ?? []).map(
        (item: {
          id: string;
          summary?: string;
          description?: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
        }): CalendarEvent => ({
          id: item.id,
          summary: item.summary ?? "",
          description: item.description,
          start: item.start?.dateTime ?? item.start?.date ?? "",
          end: item.end?.dateTime ?? item.end?.date ?? "",
          date: item.start?.date,
        })
      );
    } catch {
      return [];
    }
  }

  // calendar_id 未設定の収入源がある場合のみ全カレンダー取得が必要
  const list = sources as IncomeSource[];
  const needsAllCalendars = list.some((s) => !s.calendar_id);
  let allCalendarEvents: CalendarEvent[] = [];

  try {
    if (needsAllCalendars) {
      const calListRes = await fetch(
        `${CALENDAR_API_BASE}/users/me/calendarList?maxResults=250`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!calListRes.ok) {
        return {
          ok: false,
          error: "Google Calendarの取得に失敗しました。再ログインしてください。",
          status: 502,
        };
      }
      const calListData = await calListRes.json();
      const allCalIds: string[] = (calListData.items ?? []).map(
        (cal: { id: string }) => cal.id
      );
      const results = await Promise.all(allCalIds.map(fetchEvents));
      // 同じ予定が複数カレンダーに現れることがあるため重複を除く
      const seen = new Set<string>();
      allCalendarEvents = results.flat().filter((ev) => {
        if (seen.has(ev.id)) return false;
        seen.add(ev.id);
        return true;
      });
    }
  } catch {
    return {
      ok: false,
      error: "Google Calendarへの接続に失敗しました",
      status: 502,
    };
  }

  // 収入源ごとに取得先カレンダーを切り替えてイベント取得→給与計算
  const salaries = await Promise.all(
    list.map(async (source) => {
      const events = source.calendar_id
        ? await fetchEvents(source.calendar_id)
        : allCalendarEvents;
      const matched = events.filter((ev) => matchesKeyword(ev.summary, source.keyword));
      return calcSalary(source, matched);
    })
  );

  const totalEvents = salaries.reduce((s, sal) => s + sal.events.length, 0);
  const message =
    totalEvents === 0
      ? `${year}年${month}月の該当予定が見つかりませんでした`
      : undefined;

  return { ok: true, salaries, message };
}
