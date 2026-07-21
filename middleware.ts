import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

// 未認証ユーザーをログイン画面にリダイレクトする
export default async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // トークンなし
  if (!token) {
    // APIリクエストはリダイレクトせずJSONで401を返す
    // （302でログインHTMLを返すとfetch側がパースできず「通信エラー」になるため）
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // ページはログインへ。ログイン後に元のページへ戻れるようパスを引き継ぐ
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // RefreshAccessTokenError はここでは判定しない
  // → getServerSession 経由の jwt callback でリフレッシュを試みてから判定する

  return NextResponse.next();
}

// 認証が必要なパス（login・api/auth・静的ファイルは除外）
export const config = {
  matcher: [
    "/((?!login|api/auth|api/health|_next/static|_next/image|favicon.ico).*)",
  ],
};
