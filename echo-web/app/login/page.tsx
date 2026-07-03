import Link from "next/link";

import { getOAuthLoginUrl } from "@/lib/auth";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

/**
 * OAuth 로그인 페이지.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorMessage = params.error ? decodeURIComponent(params.error) : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <Link href="/" className="text-sm font-medium uppercase tracking-widest text-zinc-500">
          Echo
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">로그인</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          소셜 계정으로 Echo에 로그인합니다.
        </p>

        {errorMessage ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            로그인에 실패했습니다: {errorMessage}
          </p>
        ) : null}

        <div className="mt-8 space-y-3">
          <a
            href={getOAuthLoginUrl("google")}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Google로 계속하기
          </a>
          <a
            href={getOAuthLoginUrl("naver")}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#03C75A] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#02b351]"
          >
            Naver로 계속하기
          </a>
        </div>
      </div>
    </main>
  );
}
