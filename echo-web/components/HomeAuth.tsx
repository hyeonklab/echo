"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import LoginPanel from "@/components/LoginPanel";
import {
  AuthUser,
  fetchSessionUser,
  logout,
} from "@/lib/auth";

/**
 * 홈 화면 인증 상태 표시.
 */
export default function HomeAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const currentUser = await fetchSessionUser();

        if (!currentUser) {
          setUser(null);
          return;
        }

        setUser(currentUser);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
  }

  if (loading) {
    return (
      <p className="mt-6 text-sm text-zinc-500">인증 상태 확인 중...</p>
    );
  }

  if (!user) {
    return <LoginPanel />;
  }

  return (
    <div className="mt-6 max-w-md space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-800/50">
      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
        로그인됨
      </p>
      <dl className="space-y-2.5 text-sm">
        <div className="flex items-center gap-4">
          <dt className="w-14 shrink-0 text-zinc-500">이름</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">{user.displayName}</dd>
        </div>
        <div className="flex items-center gap-4">
          <dt className="w-14 shrink-0 text-zinc-500">이메일</dt>
          <dd className="min-w-0 break-all font-medium text-zinc-900 dark:text-zinc-100">{user.email ?? "-"}</dd>
        </div>
        <div className="flex items-center gap-4">
          <dt className="w-14 shrink-0 text-zinc-500">제공자</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">{user.provider}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-3 pt-2">
        <Link
          href="/friends"
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          친구 목록으로 이동
        </Link>
        <Link
          href="/chat"
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
