import { Client, IMessage } from "@stomp/stompjs";

import { getWsUrl } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import type { Message } from "@/lib/messages";
import type { RoomReadEvent } from "@/lib/room-live";
import type { PresenceUpdate } from "@/lib/presence";

export type RoomMessageHandler = (message: Message) => void;
export type RoomReadHandler = (read: RoomReadEvent) => void;
export type RoomMetaHandler = (update: RoomMetaUpdate) => void;
export type PresenceHandler = (update: PresenceUpdate) => void;

export type RoomMetaUpdate = {
  roomId: number;
  name: string;
};

/**
 * 여러 채팅방 메시지 STOMP 구독을 시작한다.
 */
export function subscribeRoomsMessages(roomIds: number[], onMessage: RoomMessageHandler): () => void {
  const uniqueRoomIds = [...new Set(roomIds)];

  if (uniqueRoomIds.length === 0) {
    return () => undefined;
  }

  const accessToken = getAccessToken();

  if (!accessToken) {
    return () => undefined;
  }

  const client = new Client({
    brokerURL: getWsUrl(),
    connectHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
    reconnectDelay: 5000,
    onConnect: () => {
      for (const roomId of uniqueRoomIds) {
        client.subscribe(`/topic/rooms/${roomId}/messages`, (frame: IMessage) => {
          const message = JSON.parse(frame.body) as Message;

          onMessage(message);
        });
      }
    },
  });

  client.activate();

  return () => {
    void client.deactivate();
  };
}

/**
 * 채팅방 메시지 STOMP 구독을 시작한다.
 */
export function subscribeRoomMessages(roomId: number, onMessage: RoomMessageHandler): () => void {
  return subscribeRoomsMessages([roomId], onMessage);
}

/**
 * 여러 채팅방 읽음 상태 STOMP 구독을 시작한다.
 */
export function subscribeRoomsReads(roomIds: number[], onRead: RoomReadHandler): () => void {
  const uniqueRoomIds = [...new Set(roomIds)];

  if (uniqueRoomIds.length === 0) {
    return () => undefined;
  }

  const accessToken = getAccessToken();

  if (!accessToken) {
    return () => undefined;
  }

  const client = new Client({
    brokerURL: getWsUrl(),
    connectHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
    reconnectDelay: 5000,
    onConnect: () => {
      for (const roomId of uniqueRoomIds) {
        client.subscribe(`/topic/rooms/${roomId}/read`, (frame: IMessage) => {
          const read = JSON.parse(frame.body) as RoomReadEvent;

          onRead(read);
        });
      }
    },
  });

  client.activate();

  return () => {
    void client.deactivate();
  };
}

/**
 * 채팅방 읽음 상태 STOMP 구독을 시작한다.
 */
export function subscribeRoomRead(roomId: number, onRead: RoomReadHandler): () => void {
  return subscribeRoomsReads([roomId], onRead);
}

/**
 * 여러 채팅방 메타 정보 STOMP 구독을 시작한다.
 */
export function subscribeRoomsMeta(roomIds: number[], onMeta: RoomMetaHandler): () => void {
  const uniqueRoomIds = [...new Set(roomIds)];

  if (uniqueRoomIds.length === 0) {
    return () => undefined;
  }

  const accessToken = getAccessToken();

  if (!accessToken) {
    return () => undefined;
  }

  const client = new Client({
    brokerURL: getWsUrl(),
    connectHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
    reconnectDelay: 5000,
    onConnect: () => {
      for (const roomId of uniqueRoomIds) {
        client.subscribe(`/topic/rooms/${roomId}/meta`, (frame: IMessage) => {
          const update = JSON.parse(frame.body) as RoomMetaUpdate;

          onMeta(update);
        });
      }
    },
  });

  client.activate();

  return () => {
    void client.deactivate();
  };
}

/**
 * 사용자 온라인 상태 STOMP 구독을 시작한다.
 */
export function subscribePresenceUpdates(
  onPresence: PresenceHandler,
  onConnected?: () => void,
): () => void {
  const accessToken = getAccessToken();

  if (!accessToken) {
    return () => undefined;
  }

  const client = new Client({
    brokerURL: getWsUrl(),
    connectHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
    reconnectDelay: 5000,
    onConnect: () => {
      client.subscribe("/topic/presence", (frame: IMessage) => {
        const update = JSON.parse(frame.body) as PresenceUpdate;

        onPresence(update);
      });

      onConnected?.();
    },
  });

  client.activate();

  return () => {
    void client.deactivate();
  };
}
