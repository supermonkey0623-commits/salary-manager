"use client";

import { useSession, signIn } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { recordAutoLoginAttempt } from "@/lib/autoLoginGuard";

// =============================================
// セッションエラーを監視して自動で再ログインする常駐コンポーネント
// - RefreshAccessTokenError: サイレント再ログイン
//   （Googleセッションが生きていれば無操作で完了する）
// - NoRefreshToken: 同意画面付き再ログインでリフレッシュトークンを
//   再取得しDBに永続化（恒久復旧ルート）
// =============================================
export default function SessionMonitor() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== "authenticated") return;
    // ログインページ側の自動処理と二重実行しない
    if (pathname === "/login") return;

    const error = session?.error;
    if (!error) return;

    // ログイン後は元いたページに戻す
    const callbackUrl = pathname || "/payslip";

    if (error === "NoRefreshToken") {
      // リフレッシュトークンが取得できていない
      // → 同意画面を挟んで再発行してもらう（10分間に最大2回まで）
      if (recordAutoLoginAttempt("auto_login_consent", 2, 10 * 60 * 1000)) {
        signIn("google", { callbackUrl }, { prompt: "consent" });
      }
    } else if (error === "RefreshAccessTokenError") {
      // リフレッシュ失敗 → サイレント再ログイン（5分間に最大3回まで）
      if (recordAutoLoginAttempt("auto_login_silent", 3, 5 * 60 * 1000)) {
        signIn("google", { callbackUrl });
      }
    }
  }, [session?.error, status, pathname]);

  return null;
}
