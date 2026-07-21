import { NextAuthOptions } from "next-auth";
import { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import { supabase } from "@/lib/supabase";

// 許可するメールアドレス（環境変数から取得）
const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL;

// =============================================
// リフレッシュトークンのDB永続化ヘルパー
// Googleは「初回同意時」にしかリフレッシュトークンを返さない。
// JWT Cookieだけに保存すると再ログインで失われ、1時間ごとに
// セッション切れが再発するため、DBにも保存して復元できるようにする。
// =============================================

// DBからリフレッシュトークンを復元する
async function loadRefreshToken(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  try {
    const { data, error } = await supabase
      .from("google_tokens")
      .select("refresh_token")
      .eq("email", email)
      .maybeSingle();
    if (error) {
      console.error("リフレッシュトークンの読込に失敗:", error.message);
      return null;
    }
    return data?.refresh_token ?? null;
  } catch (e) {
    console.error("リフレッシュトークンの読込中に例外:", e);
    return null;
  }
}

// DBにリフレッシュトークンを保存する（既存があれば上書き）
async function saveRefreshToken(email: string | null | undefined, refreshToken: string): Promise<void> {
  if (!email) return;
  try {
    const { error } = await supabase
      .from("google_tokens")
      .upsert({ email, refresh_token: refreshToken, updated_at: new Date().toISOString() });
    if (error) {
      console.error("リフレッシュトークンの保存に失敗:", error.message);
    }
  } catch (e) {
    console.error("リフレッシュトークンの保存中に例外:", e);
  }
}

// DBから失効したリフレッシュトークンを削除する
async function deleteRefreshToken(email: string | null | undefined): Promise<void> {
  if (!email) return;
  try {
    const { error } = await supabase.from("google_tokens").delete().eq("email", email);
    if (error) {
      console.error("リフレッシュトークンの削除に失敗:", error.message);
    }
  } catch (e) {
    console.error("リフレッシュトークンの削除中に例外:", e);
  }
}

// =============================================
// アクセストークンのリフレッシュ
// =============================================
async function refreshAccessToken(token: JWT): Promise<JWT> {
  // JWT内にリフレッシュトークンが無ければDBから復元を試みる
  let refreshToken = token.refreshToken;
  if (!refreshToken) {
    refreshToken = (await loadRefreshToken(token.email)) ?? undefined;
    if (!refreshToken) {
      // どこにも無い → 同意画面付き再ログインでのみ再取得可能
      // （クライアント側のSessionMonitorが自動で誘導する）
      return { ...token, error: "NoRefreshToken" };
    }
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    const refreshed = await response.json();

    if (!response.ok) {
      // invalid_grant = トークンが失効・取り消し済み
      // → DBから削除し、同意画面付き再ログインを促す（自己修復ルート）
      if (refreshed?.error === "invalid_grant") {
        await deleteRefreshToken(token.email);
        return { ...token, refreshToken: undefined, error: "NoRefreshToken" };
      }
      throw refreshed;
    }

    // リフレッシュ成功 → 動作確認済みのトークンを常にDBへ同期しておく
    // （既存セッションのトークンもここで自動的にDBへ取り込まれる）
    await saveRefreshToken(token.email, refreshed.refresh_token ?? refreshToken);

    return {
      ...token,
      error: undefined, // リフレッシュ成功時はエラーをクリア
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      refreshToken: refreshed.refresh_token ?? refreshToken,
    };
  } catch (e) {
    // 一時的な通信エラーなど → 次回リクエストで自動的に再試行される
    console.error("アクセストークンのリフレッシュに失敗:", e);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Google Calendar読み取りスコープを要求
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.readonly",
          ].join(" "),
          // リフレッシュトークン取得のため offline を指定
          access_type: "offline",
          // 使用アカウントを事前指定 → アカウント選択画面をスキップして自動ログイン
          ...(ALLOWED_EMAIL ? { login_hint: ALLOWED_EMAIL } : {}),
        },
      },
    }),
  ],
  callbacks: {
    // サインイン時にメールアドレスを検証
    async signIn({ user }) {
      if (!ALLOWED_EMAIL) {
        console.error("ALLOWED_EMAIL が設定されていません");
        return false;
      }
      if (user.email !== ALLOWED_EMAIL) {
        // 許可されていないアカウントはアクセス拒否
        return "/login?error=AccessDenied";
      }
      return true;
    },
    // JWTにアクセストークン・リフレッシュトークンを保持
    async jwt({ token, account }) {
      // サインイン直後（初回・再ログイン共通）
      if (account) {
        let refreshToken = (account.refresh_token ?? token.refreshToken) as string | undefined;

        if (account.refresh_token) {
          // Googleが新しいリフレッシュトークンを返した → DBに永続化
          await saveRefreshToken(token.email, account.refresh_token);
        } else if (!refreshToken) {
          // 再ログイン時はGoogleがリフレッシュトークンを返さない → DBから復元
          refreshToken = (await loadRefreshToken(token.email)) ?? undefined;
        }

        return {
          ...token,
          accessToken: account.access_token,
          refreshToken,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000,
          // リフレッシュトークンがどこにも無い場合はクライアントに再取得を促す
          error: refreshToken ? undefined : "NoRefreshToken",
        };
      }
      // トークンが有効期限内であればそのまま返す
      if (!token.accessTokenExpires || Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }
      // 期限切れ → リフレッシュトークンで自動更新
      return refreshAccessToken(token);
    },
    // セッションにアクセストークンを含める
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  // セッション有効期限：30日
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
};
