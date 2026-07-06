"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AuthUser, fetchSessionUser, getAccessToken } from "@/lib/auth";
import type { Message } from "@/lib/messages";
import {
  formatNotificationBody,
  formatNotificationPreview,
  requestNotificationPermission,
  shouldNotifyMessage,
  showMessageNotification,
} from "@/lib/notifications";
import { Room, fetchRooms, getRoomDisplayName } from "@/lib/rooms";
import {
  publishRoomMessageDeletedEvent,
  publishRoomMessageEvent,
  publishRoomReadEvent,
  publishRoomsSnapshotEvent,
  publishRoomUpdateEvent,
  subscribeRoomsSnapshotEvents,
  subscribeRoomLeftEvents,
  toRoomFromMetaUpdate,
  type RoomReadEvent,
} from "@/lib/room-live";
import {
  subscribeRoomsMessageDeletes,
  subscribeRoomsMessages,
  subscribeRoomsMeta,
  subscribeRoomsReads,
  subscribeUserRoomMembership,
} from "@/lib/stomp";
import type { RoomMetaUpdate } from "@/lib/stomp";

/**
 * 채팅방 목록에 신규/갱신 방 정보를 병합한다.
 */
function mergeRoomList(rooms: Room[], incoming: Room): Room[] {
  const existingIndex = rooms.findIndex((room) => room.id === incoming.id);

  if (existingIndex < 0) {
    return [incoming, ...rooms];
  }

  const next = [...rooms];
  next[existingIndex] = { ...next[existingIndex], ...incoming };

  return next;
}

/**
 * 로그인 사용자의 모든 채팅방 메시지를 구독하고 브라우저 알림을 표시한다.
 */
export default function MessageNotificationListener() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const roomsRef = useRef<Room[]>([]);
  const currentUserRef = useRef<AuthUser | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    pathnameRef.current = pathname;
    roomsRef.current = rooms;
    currentUserRef.current = currentUser;
  }, [pathname, rooms, currentUser]);

  const loadNotificationContext = useCallback(async () => {
    const token = getAccessToken();

    if (!token) {
      setCurrentUser(null);
      setRooms([]);
      setEnabled(false);
      return;
    }

    const user = await fetchSessionUser();

    if (!user) {
      setCurrentUser(null);
      setRooms([]);
      setEnabled(false);
      return;
    }

    const roomList = await fetchRooms();

    if (!roomList) {
      setCurrentUser(null);
      setRooms([]);
      setEnabled(false);
      return;
    }

    setCurrentUser(user);
    setRooms(roomList);
    setEnabled(true);
  }, []);

  useEffect(() => {
    const timerId = globalThis.setTimeout(() => {
      void loadNotificationContext();
      void requestNotificationPermission();
    }, 0);

    function handleVisibilityChange() {
      if (globalThis.document.visibilityState === "visible") {
        void loadNotificationContext();
      }
    }

    globalThis.window.addEventListener("focus", loadNotificationContext);
    globalThis.document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      globalThis.clearTimeout(timerId);
      globalThis.window.removeEventListener("focus", loadNotificationContext);
      globalThis.document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadNotificationContext, pathname]);

  useEffect(() => {
    return subscribeRoomsSnapshotEvents((snapshot) => {
      queueMicrotask(() => {
        setRooms(snapshot);
      });
    });
  }, []);

  useEffect(() => {
    return subscribeRoomLeftEvents((roomId) => {
      queueMicrotask(() => {
        setRooms((prev) => prev.filter((room) => room.id !== roomId));
      });
    });
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    return subscribeUserRoomMembership(currentUser.id, (room) => {
      setRooms((prev) => {
        const next = mergeRoomList(prev, room);
        publishRoomsSnapshotEvent(next);

        return next;
      });
    });
  }, [currentUser]);

  useEffect(() => {
    if (!enabled || !currentUser || rooms.length === 0) {
      return;
    }

    function handleIncomingMessage(message: Message) {
      publishRoomMessageEvent(message);

      const user = currentUserRef.current;

      if (!user) {
        return;
      }

      if (!shouldNotifyMessage(message.roomId, message.senderId, user.id, pathnameRef.current)) {
        return;
      }

      const room = roomsRef.current.find((item) => item.id === message.roomId);
      const roomTitle = room ? getRoomDisplayName(room, user.id) : "새 메시지";
      const senderLabel = message.senderDisplayName;
      const body =
        room?.type === "GROUP"
          ? formatNotificationBody(senderLabel, message.content)
          : formatNotificationPreview(message.content);

      showMessageNotification({
        title: roomTitle,
        body,
        roomId: message.roomId,
        onClick: () => {
          router.push(`/chat/${message.roomId}`);
        },
      });
    }

    function handleIncomingRead(read: RoomReadEvent) {
      publishRoomReadEvent(read);
    }

    function handleIncomingMeta(update: RoomMetaUpdate) {
      publishRoomUpdateEvent(toRoomFromMetaUpdate(update));
    }

    function handleIncomingDelete(deleted: { roomId: number; messageId: number }) {
      publishRoomMessageDeletedEvent(deleted);
    }

    const roomIds = rooms.map((room) => room.id);

    const unsubscribeMessages = subscribeRoomsMessages(roomIds, handleIncomingMessage);
    const unsubscribeDeletes = subscribeRoomsMessageDeletes(roomIds, handleIncomingDelete);
    const unsubscribeReads = subscribeRoomsReads(roomIds, handleIncomingRead);
    const unsubscribeMeta = subscribeRoomsMeta(roomIds, handleIncomingMeta);

    return () => {
      unsubscribeMessages();
      unsubscribeDeletes();
      unsubscribeReads();
      unsubscribeMeta();
    };
  }, [currentUser, enabled, rooms, router]);

  return null;
}
