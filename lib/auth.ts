import { NextAuthOptions } from "next-auth";
import { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      }),
    });

    const refreshed = await response.json();
    if (!response.ok) throw refreshed;

    return {
      ...token,
      error: undefined, // リフレッシュ成功時はエラーをクリア
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

// 許可するメールアドレス（環境変数から取得）
const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL;

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
      // 初回サインイン時
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          // Google は再ログイン時にリフレッシュトークンを返さないことがある → 既存を維持
          refreshToken: account.refresh_token ?? token.refreshToken,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000,
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
