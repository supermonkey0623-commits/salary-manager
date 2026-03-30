import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import path from "path";

// Vercel / Next.js のAPIルートタイムアウトを60秒に延長
export const maxDuration = 60;

// 解析結果の型
export type AnalyzeResult = {
  year_month: string;
  gross_amount: number;
  transport_allowance: number;
  taxable_amount: number;
  income_tax: number;
  other_pay: number;
  raw_pays: { name: string; amount: number }[];
  raw_deductions: { name: string; amount: number }[];
  notes: string;
};

// =============================================
// テキスト解析ユーティリティ
// =============================================

/**
 * OCRテキストの正規化
 * - 日本語文字間・日本語と数字間の誤スペースを除去（例：「支給 合計」→「支給合計」）
 * - 数字間の誤スペースを除去（例：「79 068」→「79068」）
 */
function normalizeOcrText(raw: string): string {
  let t = raw;
  // 最大5回ループして連続スペースを除去
  for (let i = 0; i < 5; i++) {
    const prev = t;
    // 非ASCII（日本語）文字同士の間のスペースを除去
    t = t.replace(/([^\x00-\x7F])\s+([^\x00-\x7F])/g, "$1$2");
    // 日本語文字と数字の間のスペースを除去（「令和 8年」「8 年」など）
    t = t.replace(/([^\x00-\x7F])\s+(\d)/g, "$1$2");
    t = t.replace(/(\d)\s+([^\x00-\x7F])/g, "$1$2");
    // 数字・区切り文字間のスペースを除去（「79 068」「79, 068」など）
    t = t.replace(/(\d)\s+([,.\d])/g, "$1$2");
    t = t.replace(/([,.])\s+(\d)/g, "$1$2");
    if (t === prev) break;
  }
  return t;
}

// 和暦を西暦に変換
function wareki2seireki(era: string, year: number): number {
  if (era === "令和") return 2018 + year;
  if (era === "平成") return 1988 + year;
  if (era === "昭和") return 1925 + year;
  return year;
}

// テキストから対象年月を抽出
function extractYearMonth(text: string): string {
  const warekiMatch = text.match(/(令和|平成|昭和)\s*(\d+)\s*年\s*(\d{1,2})\s*月/);
  if (warekiMatch) {
    const year = wareki2seireki(warekiMatch[1], Number(warekiMatch[2]));
    return `${year}-${String(Number(warekiMatch[3])).padStart(2, "0")}`;
  }
  const seirekiMatch = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
  if (seirekiMatch) {
    return `${seirekiMatch[1]}-${String(Number(seirekiMatch[2])).padStart(2, "0")}`;
  }
  return new Date().toISOString().slice(0, 7);
}

// キーワード直後の金額を抽出
// ピリオド `.` もカンマ `,` と同様に千の位区切りとして扱う（OCR誤認識対応）
function findAmount(text: string, keywords: string[]): number {
  for (const kw of keywords) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // [\d,.]+ でカンマ・ピリオド区切りの数字も捕捉
    const pattern = new RegExp(`${escaped}[^\\d\\n]{0,30}?([\\d,.]+)`, "g");
    const match = pattern.exec(text);
    if (match) {
      // カンマ・ピリオドをすべて除去して整数として解釈
      const val = parseInt(match[1].replace(/[,.]/g, ""), 10);
      if (!isNaN(val) && val >= 0) return val;
    }
  }
  return 0;
}

// テキストから支給・控除アイテムを解析してAnalyzeResultを構築
function parsePayslipText(rawText: string): AnalyzeResult {
  // OCR誤スペース・誤区切り文字を正規化してからパース
  const text = normalizeOcrText(rawText);
  const year_month = extractYearMonth(text);

  // -------------------------------------------------------
  // 支給セクション / 控除セクションに分割する
  //
  // 注意：N高フォーマットでは列ヘッダーが「勤怠支給控除その他」と
  // 正規化後に結合される場合がある。「支給控除」という複合語は
  // セクション区切りではなくヘッダーなので除外する。
  //
  // 優先順：
  //   1. 明示的な「控除合計」系キーワード
  //   2. 「支給控除」(ヘッダー)でない単独の「控除」
  //   3. フォールバック：最初の「控除」
  // -------------------------------------------------------
  const deductIdx = (() => {
    // 1. 明示的な控除合計キーワード
    for (const kw of ["控除合計", "控除額合計", "総控除額", "控除総額"]) {
      const i = text.indexOf(kw);
      if (i !== -1) return i;
    }
    // 2. 「支給控除」複合語を除いた「控除」を探す（負の後読み）
    const m = text.match(/(?<!支給)控除/);
    if (m && m.index !== undefined) return m.index;
    // 3. フォールバック
    return text.search(/控除/);
  })();

  const paySection    = deductIdx !== -1 ? text.slice(0, deductIdx) : text;
  const deductSection = deductIdx !== -1 ? text.slice(deductIdx)    : text;

  // 支給合計：支給セクション内で探す（"合計"はN高フォーマット対応）
  let gross_amount = findAmount(paySection, [
    "支給合計", "支給額合計", "総支給額", "総支給合計",
    "振込額計",
    "合計",
  ]);

  // 所得税は全体テキストから（セクション分割が不正確でも取れるように）
  const income_tax = findAmount(text, ["所得税", "源泉所得税"]);

  // 支給合計が取れない場合：差引支給額（手取り）+ 所得税で代替推定
  // ※ 他の控除がある場合は過少推定になるため、ユーザーに確認を促す
  let usedFallback = false;
  if (gross_amount === 0) {
    const sashihiki = findAmount(text, ["差引支給額", "差引支給", "振込額"]);
    if (sashihiki > 0) {
      gross_amount = sashihiki + income_tax;
      usedFallback = true;
    }
  }

  // 通勤手当・課税対象額は全体テキストから
  const transport_allowance = findAmount(text, ["通勤手当", "交通費"]);
  const taxable_amount      = findAmount(text, ["課税対象額計", "課税対象額", "課税総額", "課税合計"]);
  // その他支給は手動入力のため自動抽出しない
  const other_pay           = 0;

  const fallbackNote = usedFallback
    ? "⚠️ 支給合計が読み取れなかったため差引支給額＋所得税で推定しています。金額をご確認ください。\n"
    : "";

  return {
    year_month,
    gross_amount,
    transport_allowance,
    taxable_amount,
    income_tax,
    other_pay,
    raw_pays: [],
    raw_deductions: [],
    notes: `${fallbackNote}OCR抽出 / 支給合計:${gross_amount} / 所得税:${income_tax}\n${text.slice(0, 300)}`,
  };
}

// =============================================
// PDFテキスト抽出（テキストベースのPDF用）
// =============================================
async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    // eslint-disable-next-line no-eval
    const pdfParse = eval("require")("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text && data.text.trim().length > 10 ? data.text : null;
  } catch {
    return null;
  }
}

// =============================================
// Tesseract OCR（画像ファイル用）タイムアウト付き
// =============================================
async function ocrWithTesseract(buffer: Buffer, mimeType: string): Promise<string> {
  // 120秒でタイムアウト（初回CDNダウンロード含む）
  const TIMEOUT_MS = 120_000;

  const ocrPromise = async (): Promise<string> => {
    const { createWorker } = await import("tesseract.js");

    // 言語ファイルのキャッシュ先（プロジェクトルート/.cache/tesseract）
    // scripts/download-tessdata.js で事前ダウンロード済みならこのパスから即座に読み込む
    const cachePath = path.join(process.cwd(), ".cache", "tesseract");

    const worker = await createWorker("jpn", 1, {
      cachePath,  // キャッシュ優先（ここに jpn.traineddata があれば CDN ダウンロードをスキップ）
      cacheMethod: "write" as const,
      logger: () => {}, // ログを抑制
    });

    try {
      // BufferをBase64 DataURLに変換してtesseractに渡す
      const base64 = buffer.toString("base64");
      const dataUrl = `data:${mimeType};base64,${base64}`;
      const { data } = await worker.recognize(dataUrl);
      return data.text;
    } finally {
      await worker.terminate();
    }
  };

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("OCR処理がタイムアウトしました（45秒）。より小さい画像でお試しください。")), TIMEOUT_MS)
  );

  return Promise.race([ocrPromise(), timeoutPromise]);
}

// =============================================
// メインエンドポイント
// =============================================
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ファイル取得
  let fileBuffer: Buffer;
  let mimeType: string;
  let isPdf: boolean;

  try {
    const formData = await req.formData();

    // "pdf" または "image" キーの両方を試す
    const file = (formData.get("pdf") ?? formData.get("image")) as File | null;
    if (!file) {
      return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "ファイルサイズは15MB以下にしてください" }, { status: 400 });
    }

    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.some((t) => file.type.startsWith(t.split("/")[0]) || file.type === t)) {
      return NextResponse.json({ error: "対応形式：PDF / JPEG / PNG / WebP" }, { status: 400 });
    }

    fileBuffer = Buffer.from(await file.arrayBuffer());
    mimeType = file.type;
    isPdf = file.type === "application/pdf";
  } catch {
    return NextResponse.json({ error: "ファイルの読み込みに失敗しました" }, { status: 400 });
  }

  // テキスト抽出
  let extractedText = "";
  let method = "";

  try {
    if (isPdf) {
      // テキストベースPDFとして試みる
      const pdfText = await extractPdfText(fileBuffer);
      if (pdfText) {
        extractedText = pdfText;
        method = "PDF直接抽出";
      } else {
        // スキャン画像PDFはPNG/JPEGで再アップロードを案内
        return NextResponse.json(
          {
            error:
              "スキャン画像PDFは直接読み取れません。\n給与明細のスクリーンショット（PNG / JPEG）を撮影してアップロードしてください。",
          },
          { status: 422 }
        );
      }
    } else {
      // 画像ファイル → tesseract.js OCR
      extractedText = await ocrWithTesseract(fileBuffer, mimeType);
      method = "画像OCR";
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("テキスト抽出エラー:", msg);
    return NextResponse.json({ error: `解析エラー: ${msg}` }, { status: 500 });
  }

  if (!extractedText || extractedText.trim().length < 5) {
    return NextResponse.json(
      { error: "テキストを読み取れませんでした。鮮明な画像をアップロードしてください。" },
      { status: 422 }
    );
  }

  // テキストを給与明細データにパース
  const result = parsePayslipText(extractedText);
  result.notes = `[${method}] ` + result.notes;

  return NextResponse.json(result);
}
