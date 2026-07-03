import Link from "next/link";

/**
 * 채팅 화면 플레이스홀더.
 */
export default function ChatPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Echo Chat</p>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          채팅 준비 중
        </h1>
        <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          STOMP 실시간 채팅은 다음 단계에서 구현됩니다.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          홈으로
        </Link>
      </div>
    </main>
  );
}
