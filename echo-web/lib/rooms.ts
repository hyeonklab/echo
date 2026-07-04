const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type RoomType = "GROUP" | "DM";

export type RoomMember = {
  userId: number;
  displayName: string;
  email: string | null;
  provider: "LOCAL" | "GOOGLE" | "NAVER";
};

export type Room = {
  id: number;
  name: string;
  type: RoomType;
  createdByUserId: number;
  createdAt: string;
  members: RoomMember[];
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
 * 내 채팅방 목록을 조회한다.
 */
export async function fetchRooms(token: string): Promise<Room[]> {
  const response = await fetch(`${API_URL}/api/rooms`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  return response.json() as Promise<Room[]>;
}

/**
 * 그룹 채팅방을 생성한다.
 */
export async function createGroupRoom(
  token: string,
  name: string,
  memberUserIds: number[] = [],
): Promise<Room | null> {
  const response = await fetch(`${API_URL}/api/rooms`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name, memberUserIds }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<Room>;
}

/**
 * API 오류 메시지를 읽는다.
 */
async function readApiErrorMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { message?: string };

    if (body.message) {
      return body.message;
    }
  } catch {
    // ignore parse errors
  }

  return null;
}

/**
 * 1:1 DM 채팅방을 조회하거나 생성한다.
 */
export async function createDmRoom(
  token: string,
  targetUserId: number,
): Promise<{ room: Room | null; errorMessage: string | null }> {
  const response = await fetch(`${API_URL}/api/rooms/dm`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ targetUserId }),
    cache: "no-store",
  });

  if (!response.ok) {
    return { room: null, errorMessage: await readApiErrorMessage(response) };
  }

  return {
    room: (await response.json()) as Room,
    errorMessage: null,
  };
}

/**
 * 채팅방에 멤버를 초대한다.
 */
export async function inviteRoomMember(
  token: string,
  roomId: number,
  userId: number,
): Promise<Room | null> {
  const response = await fetch(`${API_URL}/api/rooms/${roomId}/members`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ userId }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<Room>;
}

/**
 * 채팅방을 삭제하거나 참여를 종료한다.
 */
export async function deleteRoom(token: string, roomId: number): Promise<boolean> {
  const response = await fetch(`${API_URL}/api/rooms/${roomId}`, {
    method: "DELETE",
    headers: authHeaders(token),
    cache: "no-store",
  });

  return response.ok;
}
