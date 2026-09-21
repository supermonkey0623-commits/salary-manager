import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { supabase } from "@/lib/supabase";
import { computeSalaries } from "@/lib/payslip";
import { getGoogleAccessToken } from "@/lib/googleAccessToken";
import { monthRange } from "@/lib/expense";
import { taxYearRange, payoutMonth } from "@/lib/taxYear";
import type { Expense, MonthlyRecord, ExtraIncome, Subscription, IncomeSource } from "@/types/database";

// =============================================
// MCPサーバー（外部AIクライアント向け）
//
// 通信方式は Streamable HTTP のステートレスモードを使う。
// 旧来のHTTP+SSEトランスポートはセッション状態をサーバーに保持し、
// GET接続を張り続ける前提のため、呼び出しごとにインスタンスが変わる
// サーバーレスでは成立しない（MCP仕様でも非推奨化されている）。
// ステートレスモードなら 1 POST = 1往復で完結するため相性が良い。
//
// 認証: このエンドポイントは個人の給与・支出データを返すため、
// Authorization: Bearer <MCP_API_KEY> を必須とする。
// 鍵が未設定の場合は「誤って全公開する」のを防ぐため常に拒否する。
// =============================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER_NAME = "salary-manager";
const SERVER_VERSION = "1.0.0";

// 文字列の比較で長さ・内容の差が応答時間に出ないようにする
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function isAuthorized(req: Request): boolean {
  const expected = process.env.MCP_API_KEY;
  // 鍵が未設定なら誰も通さない（設定漏れで公開されるのを防ぐ）
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return safeEqual(match[1].trim(), expected);
}

function jsonRpcError(status: number, message: string): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32001, message },
      id: null,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        ...(status === 401 ? { "WWW-Authenticate": 'Bearer realm="mcp"' } : {}),
      },
    }
  );
}

// ツールの戻り値をテキスト（JSON文字列）で返す
function asText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

const MONTH = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "YYYY-MM 形式で指定してください")
  .describe("対象年月。例: 2026-09。給与は「働いた月」で指定する（支給はその翌月）");

const YEAR = z
  .string()
  .regex(/^\d{4}$/, "YYYY 形式で指定してください")
  .describe("対象年。例: 2026。確定申告に合わせ前年12月〜当年11月の勤務分を集計する");

// 実績（年間DB）から、その月の口座入金額を求める
function depositFromRecords(records: MonthlyRecord[]): number {
  return records.reduce(
    (sum, r) => sum + r.gross_amount - r.income_tax - r.other_deduction,
    0
  );
}

function buildServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  const readOnly = { readOnlyHint: true } as const;

  // ---- 給与明細（カレンダーからの見込み） ----
  server.registerTool(
    "get_payslip",
    {
      title: "給与明細（見込み）を取得",
      description:
        "指定月のGoogleカレンダーの勤務予定から、収入源ごとの給与見込みを算出して返す。" +
        "基本給・残業・深夜・交通費などの内訳と勤務日数を含む。給与明細が未確定の月の予測に使う。",
      inputSchema: { month: MONTH },
      annotations: readOnly,
    },
    async ({ month }) => {
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        return asText({
          error:
            "Googleカレンダーへのアクセストークンを取得できませんでした。アプリに一度ログインし直してください。",
        });
      }
      const result = await computeSalaries(accessToken, month);
      if (!result.ok) return asText({ error: result.error });

      return asText({
        month,
        note: "カレンダーの予定から算出した見込み額（税引前）",
        total: result.salaries.reduce((s, x) => s + x.total, 0),
        message: result.message,
        sources: result.salaries.map((s) => ({
          name: s.source.name,
          total: s.total,
          workDays: s.workDays,
          normalPay: s.normalPay,
          overtimePay: s.overtimePay,
          nightNormalPay: s.nightNormalPay,
          nightOvertimePay: s.nightOvertimePay,
          transportFee: s.transportFee,
          extraAllowance: s.extraAllowance,
          deduction: s.deduction,
        })),
      });
    }
  );

  // ---- 給与の実績（年間DB） ----
  server.registerTool(
    "get_monthly_records",
    {
      title: "給与の実績を取得",
      description:
        "指定年の給与明細の実績（手入力済み）を月ごとに返す。支給額・所得税・その他控除・口座入金額を含む。" +
        "確定した金額を知りたいときはこちらを使う。" +
        "年月は「働いた月」で記録されており、支給はその翌月になる。" +
        "確定申告に合わせ、指定年の集計対象は前年12月〜当年11月の勤務分（＝その暦年に支給された分）。",
      inputSchema: { year: YEAR },
      annotations: readOnly,
    },
    async ({ year }) => {
      const { data, error } = await supabase
        .from("monthly_records")
        .select("*")
        .gte("year_month", taxYearRange(Number(year)).from)
        .lte("year_month", taxYearRange(Number(year)).to)
        .order("year_month", { ascending: true });

      if (error) return asText({ error: error.message });

      const records = (data ?? []) as MonthlyRecord[];
      const range = taxYearRange(Number(year));
      return asText({
        year,
        basis: `確定申告ベース。${range.from}〜${range.to} に働いた分（＝${year}年に支給された分）`,
        records: records.map((r) => ({
          yearMonth: r.year_month,
          paidIn: payoutMonth(r.year_month),
          source: r.income_source_name,
          gross: r.gross_amount,
          incomeTax: r.income_tax,
          otherDeduction: r.other_deduction,
          deposit: r.gross_amount - r.income_tax - r.other_deduction,
        })),
        totals: {
          gross: records.reduce((s, r) => s + r.gross_amount, 0),
          deposit: depositFromRecords(records),
        },
      });
    }
  );

  // ---- 支出（家計簿） ----
  server.registerTool(
    "get_expenses",
    {
      title: "支出一覧を取得",
      description:
        "指定月の支出を一覧とカテゴリ別集計で返す。内訳（メモ欄）がある支出はその明細も含む。",
      inputSchema: { month: MONTH },
      annotations: readOnly,
    },
    async ({ month }) => {
      const { from, to } = monthRange(month);
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false });

      if (error) return asText({ error: error.message });

      const expenses = (data ?? []) as Expense[];
      const byCategory: Record<string, number> = {};
      for (const e of expenses) {
        byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
      }

      return asText({
        month,
        total: expenses.reduce((s, e) => s + e.amount, 0),
        count: expenses.length,
        byCategory,
        expenses: expenses.map((e) => ({
          date: e.date,
          item: e.item,
          amount: e.amount,
          category: e.category,
          paymentMethod: e.payment_method,
          breakdown: e.breakdown ?? undefined,
        })),
      });
    }
  );

  // ---- 月の収支まとめ ----
  server.registerTool(
    "get_monthly_summary",
    {
      title: "月の収支まとめを取得",
      description:
        "指定月の収入・支出・貯蓄をまとめて返す。給与実績が未入力の月は、" +
        "カレンダーから算出した見込み額を仮の収入として使う（isEstimatedで判別できる）。" +
        "収入はその月に働いた分（支給は翌月）、支出はその月に使った分で対応させている。",
      inputSchema: { month: MONTH },
      annotations: readOnly,
    },
    async ({ month }) => {
      const year = month.slice(0, 4);
      const { from, to } = monthRange(month);

      const [recRes, extraRes, expRes] = await Promise.all([
        supabase.from("monthly_records").select("*").eq("year_month", month),
        supabase.from("extra_incomes").select("*").eq("year_month", month).maybeSingle(),
        supabase.from("expenses").select("*").gte("date", from).lte("date", to),
      ]);

      const records = (recRes.data ?? []) as MonthlyRecord[];
      const extra = (extraRes.data as ExtraIncome | null)?.amount ?? 0;
      const expenses = (expRes.data ?? []) as Expense[];
      const spent = expenses.reduce((s, e) => s + e.amount, 0);

      let income = depositFromRecords(records) + extra;
      let isEstimated = false;

      // 実績が無い月はカレンダーからの見込みで代用する
      if (records.length === 0) {
        const accessToken = await getGoogleAccessToken();
        if (accessToken) {
          const est = await computeSalaries(accessToken, month);
          if (est.ok) {
            income = est.salaries.reduce((s, x) => s + x.total, 0) + extra;
            isEstimated = true;
          }
        }
      }

      return asText({
        month,
        paidIn: payoutMonth(month),
        income,
        isEstimated,
        note: isEstimated
          ? "給与実績が未入力のため、カレンダーからの見込み額（税引前）を使用"
          : "給与実績（支給額 − 所得税 − その他控除）＋その他収入",
        extraIncome: extra,
        expense: spent,
        saving: income - spent,
        year,
      });
    }
  );

  // ---- 収入源の設定 ----
  server.registerTool(
    "list_income_sources",
    {
      title: "収入源の一覧を取得",
      description:
        "登録済みの収入源（バイト先など）と、その時給・深夜割増率・交通費などの設定を返す。",
      annotations: readOnly,
    },
    async () => {
      const { data, error } = await supabase
        .from("income_sources")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) return asText({ error: error.message });

      return asText(
        ((data ?? []) as IncomeSource[]).map((s) => ({
          name: s.name,
          keyword: s.keyword,
          hourlyRate: s.hourly_rate,
          nightRate: s.night_rate,
          transportFee: s.transport_fee,
          defaultBreakMinutes: s.default_break_minutes,
          isActive: s.is_active,
        }))
      );
    }
  );

  // ---- 固定費・サブスク ----
  server.registerTool(
    "list_subscriptions",
    {
      title: "固定費・サブスクの一覧を取得",
      description:
        "登録済みの固定費・サブスクを返す。月額・更新日・解約ルール・契約状態を含む。",
      annotations: readOnly,
    },
    async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .order("amount", { ascending: false });

      if (error) return asText({ error: error.message });

      const subs = (data ?? []) as Subscription[];
      const active = subs.filter((s) => s.is_active);
      return asText({
        monthlyTotal: active.reduce((s, x) => s + x.amount, 0),
        subscriptions: subs.map((s) => ({
          name: s.name,
          amount: s.amount,
          renewalDay: s.renewal_day,
          cancelNote: s.cancel_note ?? undefined,
          memo: s.memo ?? undefined,
          isActive: s.is_active,
        })),
      });
    }
  );

  return server;
}

// ステートレスなので、リクエストごとにサーバーとトランスポートを作る
async function handle(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return jsonRpcError(401, "Unauthorized: valid Bearer token required");
  }

  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    // sessionIdGenerator を省くとステートレスモードになる
    sessionIdGenerator: undefined,
    // SSEストリームを張らずJSONで返す。サーバーレスでは接続を保持できないため
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function POST(req: Request) {
  return handle(req);
}

// GET / DELETE はステートレスでは使わないが、
// クライアントが疎通確認に来ることがあるため明示的に応答する
export async function GET(req: Request) {
  return handle(req);
}

export async function DELETE(req: Request) {
  return handle(req);
}
