import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

// 未認証ユーザーをログイン画面にリダイレクトする
export default async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // トークンなし → ログインページへ
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // セッションエラー（アクセストークン期限切れ）→ 再認証
  if (token.error === "RefreshAccessTokenError") {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("error", "SessionExpired");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// 認証が必要なパス（login・api/auth・静的ファイルは除外）
export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
