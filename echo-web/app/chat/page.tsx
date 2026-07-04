import ChatRoomList from "@/components/ChatRoomList";

/**
 * 채팅방 목록 페이지.
 */
export default function ChatPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-16 font-sans dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Echo Chat</p>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">채팅방</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          그룹 채팅방을 만들거나 1:1 DM을 시작하세요.
        </p>
        <div className="mt-8">
          <ChatRoomList />
        </div>
      </div>
    </main>
  );
}
