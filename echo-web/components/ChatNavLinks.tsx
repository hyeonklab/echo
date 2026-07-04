import Link from "next/link";

type ChatNavLinksProps = {
  current?: "chat" | "friends" | "room";
};

/**
 * 채팅 관련 페이지 상단 네비게이션.
 */
export default function ChatNavLinks({ current }: ChatNavLinksProps) {
  return (
    <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-zinc-500">
      <Link
        href="/chat"
        aria-current={current === "chat" ? "page" : undefined}
        className={`transition hover:text-zinc-700 dark:hover:text-zinc-300 ${
          current === "chat" ? "text-zinc-900 dark:text-zinc-100" : ""
        }`}
      >
        채팅방
      </Link>
      <span aria-hidden="true" className="text-zinc-400">
        ·
      </span>
      <Link
        href="/friends"
        aria-current={current === "friends" ? "page" : undefined}
        className={`transition hover:text-zinc-700 dark:hover:text-zinc-300 ${
          current === "friends" ? "text-zinc-900 dark:text-zinc-100" : ""
        }`}
      >
        친구 목록
      </Link>
      {current === "room" ? (
        <>
          <span aria-hidden="true" className="text-zinc-400">
            ·
          </span>
          <span className="text-zinc-900 dark:text-zinc-100">대화 중</span>
        </>
      ) : null}
    </nav>
  );
}
