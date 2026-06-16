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

  // RefreshAccessTokenError はここでは判定しない
  // → getServerSession 経由の jwt callback でリフレッシュを試みてから判定する

  return NextResponse.next();
}

// 認証が必要なパス（login・api/auth・静的ファイルは除外）
export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
