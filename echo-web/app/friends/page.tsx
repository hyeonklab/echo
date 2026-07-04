import FriendList from "@/components/FriendList";
import ChatNavLinks from "@/components/ChatNavLinks";

/**
 * 친구 목록 페이지.
 */
export default function FriendsPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-16 font-sans dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Echo Chat</p>
        <div className="mt-3">
          <ChatNavLinks current="friends" />
        </div>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">친구</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          친구를 추가하고 바로 1:1 대화를 시작하세요.
        </p>
        <div className="mt-8">
          <FriendList />
        </div>
      </div>
    </main>
  );
}
