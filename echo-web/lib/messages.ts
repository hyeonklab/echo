import { ensureAccessToken } from "@/lib/auth";
import { apiFetch, getApiUrl } from "@/lib/api";

export type MessageDeleteScope = "me" | "all";

export type MessageDeletedEvent = {
  roomId: number;
  messageId: number;
};

export type Message = {
  id: number;
  roomId: number;
  senderId: number;
  senderDisplayName: string;
  content: string;
  createdAt: string;
};

export type MemberReadState = {
  userId: number;
  lastReadMessageId: number | null;
};

export type MessageHistory = {
  messages: Message[];
  hasMore: boolean;
  peerLastReadMessageId: number | null;
  memberReadStates: MemberReadState[];
};

/**
 * 인증 헤더를 구성한다.
 */
function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * API 호출용 access token을 확보한다.
 */
async function resolveAccessToken(): Promise<string | null> {
  return ensureAccessToken();
}

/**
 * 채팅방 메시지 히스토리를 조회한다.
 */
export async function fetchMessages(
  roomId: number,
  options?: { before?: number; limit?: number },
): Promise<MessageHistory | null> {
  const token = await resolveAccessToken();

  if (!token) {
    return null;
  }

  const params = new URLSearchParams();

  if (options?.before != null) {
    params.set("before", String(options.before));
  }

  if (options?.limit != null) {
    params.set("limit", String(options.limit));
  }

  const query = params.toString();
  const response = await apiFetch(
    `${getApiUrl()}/api/rooms/${roomId}/messages${query ? `?${query}` : ""}`,
    {
      headers: authHeaders(token),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<MessageHistory>;
}

/**
 * 채팅방에 메시지를 전송한다.
 */
export async function sendMessage(roomId: number, content: string): Promise<Message | null> {
  const token = await resolveAccessToken();

  if (!token) {
    return null;
  }

  const response = await apiFetch(`${getApiUrl()}/api/rooms/${roomId}/messages`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ content }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<Message>;
}

/**
 * 메시지를 삭제한다.
 */
export async function deleteMessage(
  roomId: number,
  messageId: number,
  scope: MessageDeleteScope,
): Promise<boolean> {
  const token = await resolveAccessToken();

  if (!token) {
    return false;
  }

  const params = new URLSearchParams({ scope });
  const response = await apiFetch(
    `${getApiUrl()}/api/rooms/${roomId}/messages/${messageId}?${params.toString()}`,
    {
      method: "DELETE",
      headers: authHeaders(token),
      cache: "no-store",
    },
  );

  return response.ok;
}
