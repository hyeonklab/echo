"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { fetchSessionUser } from "@/lib/auth";
import { fetchRooms, type Room } from "@/lib/rooms";
import {
  applyIncomingMessageToRooms,
  applyRoomReadToRooms,
  getTotalUnreadCount,
  getViewingRoomId,
  subscribeRoomMessageEvents,
  subscribeRoomReadEvents,
  subscribeRoomsSnapshotEvents,
} from "@/lib/room-live";

/**
 * 로그인 사용자의 채팅방 총 미읽음 수를 실시간으로 반환한다.
 */
export function useChatUnreadCount(): number {
  const pathname = usePathname();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const loadRooms = useCallback(async () => {
    const user = await fetchSessionUser();

    if (!user) {
      setCurrentUserId(null);
      setRooms([]);
      return;
    }

    const roomList = await fetchRooms();

    setCurrentUserId(user.id);
    setRooms(roomList);
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (globalThis.document.visibilityState === "visible") {
        void loadRooms();
      }
    }

    globalThis.window.addEventListener("focus", loadRooms);
    globalThis.document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      globalThis.window.removeEventListener("focus", loadRooms);
      globalThis.document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadRooms]);

  useEffect(() => {
    return subscribeRoomsSnapshotEvents((snapshot) => {
      setRooms(snapshot);
    });
  }, []);

  useEffect(() => {
    const viewingRoomId = getViewingRoomId(pathname);

    return subscribeRoomMessageEvents((message) => {
      setRooms((prev) =>
        applyIncomingMessageToRooms(prev, message, {
          currentUserId: currentUserId ?? undefined,
          viewingRoomId,
        }),
      );
    });
  }, [currentUserId, pathname]);

  useEffect(() => {
    if (currentUserId == null) {
      return;
    }

    return subscribeRoomReadEvents((read) => {
      setRooms((prev) => applyRoomReadToRooms(prev, read, currentUserId));
    });
  }, [currentUserId]);

  return getTotalUnreadCount(rooms);
}
