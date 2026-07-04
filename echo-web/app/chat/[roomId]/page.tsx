"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import ChatRoomView from "@/components/ChatRoomView";
import ChatNavLinks from "@/components/ChatNavLinks";

/**
 * 채팅방 상세 페이지.
 */
export default function ChatRoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = Number(params.roomId);
  const isValidRoomId = Number.isInteger(roomId) && roomId > 0;

  useEffect(() => {
    if (!isValidRoomId) {
      router.replace("/chat");
    }
  }, [isValidRoomId, router]);

  if (!isValidRoomId) {
    return null;
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-16 font-sans dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Echo Chat</p>
        <div className="mt-3">
          <ChatNavLinks current="room" />
        </div>
        <div className="mt-6">
          <ChatRoomView roomId={roomId} />
        </div>
      </div>
    </main>
  );
}
