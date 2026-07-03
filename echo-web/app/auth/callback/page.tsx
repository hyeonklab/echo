"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { setTokens } from "@/lib/auth";

/**
 * OAuth 콜백에서 query parameter 토큰을 저장한다.
 */
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const refreshToken = searchParams.get("refreshToken");

    if (!token) {
      setError("인증 토큰이 없습니다. 다시 로그인해 주세요.");
      return;
    }

    setTokens(token, refreshToken);
    router.replace("/");
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          로그인으로 돌아가기
        </Link>
      </div>
    );
  }

  return <p className="text-sm text-zinc-500">로그인 처리 중...</p>;
}

/**
 * OAuth 인증 콜백 페이지.
 */
export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <Suspense fallback={<p className="text-sm text-zinc-500">로그인 처리 중...</p>}>
          <AuthCallbackContent />
        </Suspense>
      </div>
    </main>
  );
}
