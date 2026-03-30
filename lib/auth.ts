import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

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
          // 毎回同意画面を表示してリフレッシュトークンを取得
          access_type: "offline",
          prompt: "consent",
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
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : 0;
      }
      // アクセストークンの有効期限チェック（期限切れなら再認証を促す）
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }
      // 期限切れの場合はトークンをクリアして再認証を促す
      return { ...token, error: "RefreshAccessTokenError" };
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
  // セッション有効期限：24時間
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
};
