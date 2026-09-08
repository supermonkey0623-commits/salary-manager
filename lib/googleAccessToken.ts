import { supabase } from "@/lib/supabase";

// =============================================
// ログインセッションを持たない経路（MCPなど）から
// Google Calendarを読むためのアクセストークン取得
//
// 画面側はNextAuthのセッションからアクセストークンを得るが、
// 外部クライアントにはセッションがない。そのためDBに永続化してある
// リフレッシュトークン（google_tokens）から都度交換する。
// =============================================
export async function getGoogleAccessToken(): Promise<string | null> {
  const email = process.env.ALLOWED_EMAIL;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!email || !clientId || !clientSecret) return null;

  const { data, error } = await supabase
    .from("google_tokens")
    .select("refresh_token")
    .eq("email", email)
    .maybeSingle();

  if (error || !data?.refresh_token) return null;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: data.refresh_token,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch {
    return null;
  }
}
