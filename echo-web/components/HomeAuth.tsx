"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  AuthUser,
  clearTokens,
  fetchCurrentUser,
  getAccessToken,
  getOAuthLoginUrl,
} from "@/lib/auth";

/**
 * 홈 화면 인증 상태 표시.
 */
export default function HomeAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = getAccessToken();

      if (!token) {
        setLoading(false);
        return;
      }

      const currentUser = await fetchCurrentUser(token);

      if (!currentUser) {
        clearTokens();
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);
      setLoading(false);
    }

    loadUser();
  }, []);

  function handleLogout() {
    clearTokens();
    setUser(null);
  }

  if (loading) {
    return (
      <p className="mt-6 text-sm text-zinc-500">인증 상태 확인 중...</p>
    );
  }

  if (!user) {
    return (
      <div className="mt-8 flex flex-col gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          로그인 후 채팅 기능을 사용할 수 있습니다.
        </p>
        <Link
          href="/login"
          className="inline-flex w-fit items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          로그인
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-800/50">
      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
        로그인됨
      </p>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">이름</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">{user.displayName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">이메일</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">{user.email ?? "-"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">제공자</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">{user.provider}</dd>
        </div>
      </dl>
      <div className="flex gap-3 pt-2">
        <Link
          href="/chat"
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          채팅으로 이동
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
