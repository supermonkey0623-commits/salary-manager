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

// 認証が必要なパス
// 除外対象（公開必須）：
//   - login / api/auth / api/health
//   - manifest.webmanifest（PWA定義。非公開だとアイコンが読めず頭文字表示になる）
//   - icon / apple-icon（動的生成のfavicon・iOSアイコン）
//   - _next/static / _next/image / favicon.ico
//   - 拡張子付きの静的ファイル全般（.png .ico .svg など。末尾の \..* で判定）
export const config = {
  matcher: [
    "/((?!login|api/auth|api/health|api/mcp|manifest.webmanifest|icon|apple-icon|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
