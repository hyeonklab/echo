"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { formatUnreadCount } from "@/lib/room-live";
import { useChatUnreadCount } from "@/lib/use-chat-unread-count";

type SidebarItemProps = {
  href: string;
  label: string;
  active: boolean;
  badgeCount?: number;
  children: React.ReactNode;
};

/**
 * 사이드바 아이콘 버튼.
 */
function SidebarItem({ href, label, active, badgeCount = 0, children }: Readonly<SidebarItemProps>) {
  const badgeLabel = badgeCount > 0 ? formatUnreadCount(badgeCount) : null;

  return (
    <Link
      href={href}
      aria-label={badgeLabel ? `${label}, 미읽음 ${badgeLabel}개` : label}
      aria-current={active ? "page" : undefined}
      title={label}
      className={`relative flex h-12 w-12 items-center justify-center rounded-xl transition ${
        active
          ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
          : "text-zinc-500 hover:bg-white/70 hover:text-zinc-800 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-200"
      }`}
    >
      {children}
      {badgeLabel ? (
        <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-red-500 px-1 py-0.5 text-center text-[10px] font-semibold leading-none text-white">
          {badgeLabel}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * 카카오톡 스타일 좌측 아이콘 네비게이션.
 */
export default function AppSidebar() {
  const pathname = usePathname();
  const totalUnreadCount = useChatUnreadCount();
  const isHome = pathname === "/home";
  const isFriends = pathname.startsWith("/friends");
  const isChat = pathname === "/chat" || pathname.startsWith("/chat/");

  return (
    <aside className="flex w-[72px] shrink-0 flex-col items-center border-r border-zinc-200 bg-zinc-100 py-4 dark:border-zinc-800 dark:bg-zinc-950">
      <nav className="flex flex-col items-center gap-3">
        <SidebarItem href="/home" label="홈" active={isHome}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z" />
          </svg>
        </SidebarItem>
        <SidebarItem href="/friends" label="친구" active={isFriends}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </SidebarItem>
        <SidebarItem href="/chat" label="채팅" active={isChat} badgeCount={totalUnreadCount}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
          </svg>
        </SidebarItem>
      </nav>
    </aside>
  );
}
