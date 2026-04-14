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
          // リフレッシュトークン取得のため offline を指定
          // select_account：毎回同意画面は出さずアカウント選択のみ表示
          access_type: "offline",
          prompt: "select_account",
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
      // 初回サインイン時：account が存在するので即座にトークンを返す
      // ここで expires_at チェックをしないことでログインループを防ぐ
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          // expires_at が未設定の場合はデフォルト1時間を設定
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000,
        };
      }
      // 2回目以降：トークンが有効期限内であればそのまま返す
      // accessTokenExpires が未設定の場合も有効とみなす
      if (!token.accessTokenExpires || Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }
      // 期限切れの場合はエラーを設定して再認証を促す
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
  // セッション有効期限：30日
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
};
