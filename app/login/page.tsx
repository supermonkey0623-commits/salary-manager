"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { recordAutoLoginAttempt } from "@/lib/autoLoginGuard";
import { markAppReady } from "@/lib/appReady";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "このGoogleアカウントはアクセスが許可されていません。",
  SessionExpired: "セッションの自動更新に失敗しました。再度ログインしてください。",
  AutoLoginFailed: "自動ログインが繰り返し失敗しました。ボタンから再度お試しください。",
  Default: "ログインに失敗しました。再度お試しください。",
};

function LoginContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  // 自動ログインがループした場合のみ手動ボタンにフォールバックする
  const [autoFailed, setAutoFailed] = useState(false);

  // ログイン後の戻り先（オープンリダイレクト防止のため相対パスのみ許可）
  const rawCallback = searchParams.get("callbackUrl");
  const callbackUrl =
    rawCallback && rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : "/payslip";

  // エラーなし・セッション切れ → 自動でGoogle OAuthへ（無操作でログイン完了）
  // AccessDenied（アカウント違い）だけは自動リトライしない
  const shouldAutoLogin = !errorCode || errorCode === "SessionExpired";

  useEffect(() => {
    // ログイン画面まで来たらスプラッシュの役目は終わり
    markAppReady();
    if (!shouldAutoLogin) return;
    // 5分間に4回以上リダイレクトが繰り返される場合はループとみなして停止
    if (!recordAutoLoginAttempt("login_page_auto", 3, 5 * 60 * 1000)) {
      setAutoFailed(true);
      return;
    }
    signIn("google", { callbackUrl });
  }, [shouldAutoLogin, callbackUrl]);

  const handleLogin = () => {
    signIn("google", { callbackUrl });
  };

  // 自動リダイレクト中の表示
  if (shouldAutoLogin && !autoFailed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-500">ログイン中...</p>
        </div>
      </div>
    );
  }

  const errorMessage = autoFailed
    ? ERROR_MESSAGES.AutoLoginFailed
    : ERROR_MESSAGES[errorCode ?? ""] ?? ERROR_MESSAGES.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">給与管理</h1>
          <p className="text-sm text-gray-500">
            Googleアカウントでログインしてください
          </p>
        </div>

        {/* エラーメッセージ */}
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>

        {/* Googleログインボタン */}
        <button
          onClick={handleLogin}
          className="btn3d btn-neutral w-full py-3.5 px-4 text-sm text-gray-700"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path
              fill="#4285F4"
              d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"
            />
            <path
              fill="#34A853"
              d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"
            />
            <path
              fill="#FBBC05"
              d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"
            />
            <path
              fill="#EA4335"
              d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"
            />
          </svg>
          Googleでログイン
        </button>

        <p className="mt-6 text-xs text-center text-gray-400">
          ログインすることでGoogle Calendarへのアクセスを許可します
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
