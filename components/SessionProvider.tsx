"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

// クライアントコンポーネント用のSessionProviderラッパー
// refetchInterval: 45分ごとにセッションを更新し、アクセストークンの自動リフレッシュを確実に行う
// refetchOnWindowFocus: タブ復帰時にも更新（スマホでアプリを開き直したとき対応）
export default function SessionProvider({ children }: Props) {
  return (
    <NextAuthSessionProvider refetchInterval={45 * 60} refetchOnWindowFocus>
      {children}
    </NextAuthSessionProvider>
  );
}
