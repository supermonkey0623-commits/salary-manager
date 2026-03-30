"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

// クライアントコンポーネント用のSessionProviderラッパー
export default function SessionProvider({ children }: Props) {
  return (
    <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
  );
}
