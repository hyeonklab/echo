import { Client, IMessage } from "@stomp/stompjs";

import { getWsUrl } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import type { Message } from "@/lib/messages";

export type RoomMessageHandler = (message: Message) => void;

/**
 * 채팅방 메시지 STOMP 구독을 시작한다.
 */
export function subscribeRoomMessages(roomId: number, onMessage: RoomMessageHandler): () => void {
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
      client.subscribe(`/topic/rooms/${roomId}/messages`, (frame: IMessage) => {
        const message = JSON.parse(frame.body) as Message;

        onMessage(message);
      });
    },
  });

  client.activate();

  return () => {
    void client.deactivate();
  };
}
