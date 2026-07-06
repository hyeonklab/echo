import type { Message, MessageDeletedEvent } from "@/lib/messages";
import type { RoomMetaUpdate } from "@/lib/stomp";
import type { LastMessagePreview, Room } from "@/lib/rooms";

export const ROOM_MESSAGE_EVENT = "echo:room-message";
export const ROOM_MESSAGE_DELETED_EVENT = "echo:room-message-deleted";
export const ROOM_READ_EVENT = "echo:room-read";
export const ROOM_UPDATE_EVENT = "echo:room-update";
export const ROOMS_SNAPSHOT_EVENT = "echo:rooms-snapshot";
export const ROOM_LEFT_EVENT = "echo:room-left";

export type RoomReadEvent = {
  roomId: number;
  userId: number;
  lastReadMessageId: number;
};

type ApplyIncomingMessageOptions = {
  currentUserId?: number;
  viewingRoomId?: number | null;
};

/**
 * 채팅방 활동 시각을 반환한다.
 */
function getRoomActivityTime(room: Room): string {
  return room.lastMessage?.createdAt ?? room.createdAt;
}

/**
 * 최근 메시지 기준으로 채팅방 목록을 정렬한다.
 */
export function sortRoomsByLastActivity(rooms: Room[]): Room[] {
  return [...rooms].sort((left, right) =>
    getRoomActivityTime(right).localeCompare(getRoomActivityTime(left)),
  );
}

/**
 * 수신 메시지로 채팅방 목록의 미리보기를 갱신한다.
 */
export function applyIncomingMessageToRooms(
  rooms: Room[],
  message: Message,
  options: ApplyIncomingMessageOptions = {},
): Room[] {
  const targetRoom = rooms.find((room) => room.id === message.roomId);

  if (!targetRoom) {
    return rooms;
  }

  const lastMessage: LastMessagePreview = {
    id: message.id,
    senderId: message.senderId,
    senderDisplayName: message.senderDisplayName,
    content: message.content,
    createdAt: message.createdAt,
  };

  const shouldIncreaseUnread =
    options.currentUserId != null
    && message.senderId !== options.currentUserId
    && options.viewingRoomId !== message.roomId;

  const updated = rooms.map((room) => {
    if (room.id !== message.roomId) {
      return room;
    }

    return {
      ...room,
      lastMessage,
      unreadCount: shouldIncreaseUnread ? room.unreadCount + 1 : room.unreadCount,
    };
  });

  return sortRoomsByLastActivity(updated);
}

/**
 * 메시지 삭제로 채팅방 목록의 미리보기를 갱신한다.
 */
export function applyMessageDeletedToRooms(rooms: Room[], deleted: MessageDeletedEvent): Room[] {
  return rooms.map((room) => {
    if (room.id !== deleted.roomId) {
      return room;
    }

    if (room.lastMessage?.id !== deleted.messageId) {
      return room;
    }

    return {
      ...room,
      lastMessage: null,
    };
  });
}

/**
 * 읽음 처리로 채팅방 목록의 미읽음 수를 갱신한다.
 */
export function applyRoomReadToRooms(
  rooms: Room[],
  read: RoomReadEvent,
  currentUserId: number,
): Room[] {
  if (read.userId !== currentUserId) {
    return rooms;
  }

  return rooms.map((room) => {
    if (room.id !== read.roomId) {
      return room;
    }

    return {
      ...room,
      unreadCount: 0,
    };
  });
}

/**
 * 채팅방 정보 변경으로 채팅방 목록을 갱신한다.
 */
export function applyRoomUpdateToRooms(rooms: Room[], updatedRoom: Room): Room[] {
  const hasRoom = rooms.some((room) => room.id === updatedRoom.id);

  if (!hasRoom) {
    return rooms;
  }

  return rooms.map((room) => {
    if (room.id !== updatedRoom.id) {
      return room;
    }

    return {
      ...room,
      ...updatedRoom,
    };
  });
}

/**
 * 채팅방 목록의 총 미읽음 수를 반환한다.
 */
export function getTotalUnreadCount(rooms: Room[]): number {
  return rooms.reduce((total, room) => total + (room.unreadCount ?? 0), 0);
}

/**
 * STOMP 메타 변경을 채팅방 목록용 Room 객체로 변환한다.
 */
export function toRoomFromMetaUpdate(update: RoomMetaUpdate): Room {
  return {
    id: update.roomId,
    name: update.name,
  } as Room;
}

/**
 * 채팅방 메시지 수신 이벤트를 발행한다.
 */
export function publishRoomMessageEvent(message: Message): void {
  if (globalThis.window === undefined) {
    return;
  }

  globalThis.window.dispatchEvent(
    new CustomEvent<Message>(ROOM_MESSAGE_EVENT, { detail: message }),
  );
}

/**
 * 채팅방 메시지 삭제 이벤트를 발행한다.
 */
export function publishRoomMessageDeletedEvent(deleted: MessageDeletedEvent): void {
  if (globalThis.window === undefined) {
    return;
  }

  globalThis.window.dispatchEvent(
    new CustomEvent<MessageDeletedEvent>(ROOM_MESSAGE_DELETED_EVENT, { detail: deleted }),
  );
}

/**
 * 채팅방 읽음 이벤트를 발행한다.
 */
export function publishRoomReadEvent(read: RoomReadEvent): void {
  if (globalThis.window === undefined) {
    return;
  }

  globalThis.window.dispatchEvent(
    new CustomEvent<RoomReadEvent>(ROOM_READ_EVENT, { detail: read }),
  );
}

/**
 * 채팅방 정보 변경 이벤트를 발행한다.
 */
export function publishRoomUpdateEvent(room: Room): void {
  if (globalThis.window === undefined) {
    return;
  }

  globalThis.window.dispatchEvent(
    new CustomEvent<Room>(ROOM_UPDATE_EVENT, { detail: room }),
  );
}

/**
 * 채팅방 목록 스냅샷 이벤트를 발행한다.
 */
export function publishRoomsSnapshotEvent(rooms: Room[]): void {
  if (globalThis.window === undefined) {
    return;
  }

  queueMicrotask(() => {
    globalThis.window.dispatchEvent(
      new CustomEvent<Room[]>(ROOMS_SNAPSHOT_EVENT, { detail: rooms }),
    );
  });
}

/**
 * 채팅방 나가기 이벤트를 발행한다.
 */
export function publishRoomLeftEvent(roomId: number): void {
  if (globalThis.window === undefined) {
    return;
  }

  queueMicrotask(() => {
    globalThis.window.dispatchEvent(
      new CustomEvent<number>(ROOM_LEFT_EVENT, { detail: roomId }),
    );
  });
}

/**
 * 채팅방 메시지 수신 이벤트를 구독한다.
 */
export function subscribeRoomMessageEvents(handler: (message: Message) => void): () => void {
  function onRoomMessage(event: Event) {
    handler((event as CustomEvent<Message>).detail);
  }

  globalThis.window.addEventListener(ROOM_MESSAGE_EVENT, onRoomMessage);

  return () => {
    globalThis.window.removeEventListener(ROOM_MESSAGE_EVENT, onRoomMessage);
  };
}

/**
 * 채팅방 메시지 삭제 이벤트를 구독한다.
 */
export function subscribeRoomMessageDeletedEvents(
  handler: (deleted: MessageDeletedEvent) => void,
): () => void {
  function onRoomMessageDeleted(event: Event) {
    handler((event as CustomEvent<MessageDeletedEvent>).detail);
  }

  globalThis.window.addEventListener(ROOM_MESSAGE_DELETED_EVENT, onRoomMessageDeleted);

  return () => {
    globalThis.window.removeEventListener(ROOM_MESSAGE_DELETED_EVENT, onRoomMessageDeleted);
  };
}

/**
 * 채팅방 읽음 이벤트를 구독한다.
 */
export function subscribeRoomReadEvents(handler: (read: RoomReadEvent) => void): () => void {
  function onRoomRead(event: Event) {
    handler((event as CustomEvent<RoomReadEvent>).detail);
  }

  globalThis.window.addEventListener(ROOM_READ_EVENT, onRoomRead);

  return () => {
    globalThis.window.removeEventListener(ROOM_READ_EVENT, onRoomRead);
  };
}

/**
 * 채팅방 정보 변경 이벤트를 구독한다.
 */
export function subscribeRoomUpdateEvents(handler: (room: Room) => void): () => void {
  function onRoomUpdate(event: Event) {
    handler((event as CustomEvent<Room>).detail);
  }

  globalThis.window.addEventListener(ROOM_UPDATE_EVENT, onRoomUpdate);

  return () => {
    globalThis.window.removeEventListener(ROOM_UPDATE_EVENT, onRoomUpdate);
  };
}

/**
 * 채팅방 목록 스냅샷 이벤트를 구독한다.
 */
export function subscribeRoomsSnapshotEvents(handler: (rooms: Room[]) => void): () => void {
  function onRoomsSnapshot(event: Event) {
    handler((event as CustomEvent<Room[]>).detail);
  }

  globalThis.window.addEventListener(ROOMS_SNAPSHOT_EVENT, onRoomsSnapshot);

  return () => {
    globalThis.window.removeEventListener(ROOMS_SNAPSHOT_EVENT, onRoomsSnapshot);
  };
}

/**
 * 채팅방 나가기 이벤트를 구독한다.
 */
export function subscribeRoomLeftEvents(handler: (roomId: number) => void): () => void {
  function onRoomLeft(event: Event) {
    handler((event as CustomEvent<number>).detail);
  }

  globalThis.window.addEventListener(ROOM_LEFT_EVENT, onRoomLeft);

  return () => {
    globalThis.window.removeEventListener(ROOM_LEFT_EVENT, onRoomLeft);
  };
}

/**
 * 현재 경로에서 보고 있는 채팅방 ID를 반환한다.
 */
export function getViewingRoomId(pathname: string): number | null {
  const match = pathname.match(/^\/chat\/(\d+)$/);

  if (!match) {
    return null;
  }

  const roomId = Number(match[1]);

  if (!Number.isInteger(roomId) || roomId <= 0) {
    return null;
  }

  return roomId;
}

/**
 * 미읽음 배지 표시 문구를 반환한다.
 */
export function formatUnreadCount(count: number): string {
  if (count > 99) {
    return "99+";
  }

  return String(count);
}
