import { ensureAccessToken, handleUnauthorized } from "@/lib/auth";
import { apiFetch, getApiUrl } from "@/lib/api";

export type RoomType = "GROUP" | "DM" | "SELF";

export type RoomMember = {
  userId: number;
  displayName: string;
  email: string | null;
  provider: "LOCAL" | "GOOGLE" | "NAVER";
  avatarFileId: number | null;
};

export type LastMessagePreview = {
  id: number;
  senderId: number;
  senderDisplayName: string;
  content: string;
  createdAt: string;
};

export type Room = {
  id: number;
  name: string;
  type: RoomType;
  createdByUserId: number;
  createdAt: string;
  members: RoomMember[];
  lastMessage: LastMessagePreview | null;
  unreadCount: number;
};

/**
 * 채팅방 목록용 마지막 메시지 미리보기 문구를 반환한다.
 */
export function formatLastMessagePreview(room: Room, currentUserId: number): string {
  if (!room.lastMessage) {
    return "메시지가 없습니다.";
  }

  const normalized = room.lastMessage.content.replace(/\s+/g, " ").trim();
  const preview = normalized.length > 0
    ? (normalized.length > 60 ? `${normalized.slice(0, 60)}...` : normalized)
    : "사진";

  if (room.type === "GROUP") {
    const senderLabel =
      room.lastMessage.senderId === currentUserId ? "나" : room.lastMessage.senderDisplayName;

    return `${senderLabel}: ${preview}`;
  }

  return preview;
}

/**
 * 마지막 메시지 시간을 목록 표시 형식으로 변환한다.
 */
export function formatLastMessageTime(value: string): string {
  return new Date(value).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 요청 사용자 기준 채팅방 표시 이름을 반환한다.
 */
export function getRoomDisplayName(room: Room, currentUserId: number): string {
  if (room.type !== "DM") {
    return room.name;
  }

  const otherMember = room.members.find((member) => member.userId !== currentUserId);

  if (!otherMember) {
    return room.name;
  }

  return otherMember.displayName;
}

/**
 * 그룹 채팅방 멤버 초대 가능 여부를 반환한다.
 */
export function canInviteToRoom(type: RoomType): boolean {
  return type === "GROUP";
}

/**
 * 채팅방 이름 변경 가능 여부를 반환한다.
 */
export function canRenameRoom(type: RoomType): boolean {
  return type === "GROUP" || type === "SELF";
}

/**
 * 채팅방 유형 라벨을 반환한다.
 */
export function getRoomTypeLabel(type: RoomType): string {
  if (type === "SELF") {
    return "나와의 대화";
  }

  if (type === "DM") {
    return "1:1 DM";
  }

  return "그룹";
}

/**
 * 채팅방 멤버를 userId로 조회한다.
 */
export function getRoomMember(room: Room, userId: number): RoomMember | undefined {
  return room.members.find((member) => member.userId === userId);
}

/**
 * 채팅방 목록/헤더용 아바타 대상 멤버 목록을 반환한다.
 */
export function getRoomAvatarMembers(room: Room, currentUserId: number): RoomMember[] {
  if (room.type === "DM") {
    const otherMember = room.members.find((member) => member.userId !== currentUserId);

    if (otherMember) {
      return [otherMember];
    }

    return room.members.slice(0, 1);
  }

  if (room.type === "SELF") {
    const selfMember = room.members.find((member) => member.userId === currentUserId);

    if (selfMember) {
      return [selfMember];
    }

    return room.members.slice(0, 1);
  }

  const otherMembers = room.members.filter((member) => member.userId !== currentUserId);

  if (otherMembers.length > 0) {
    return otherMembers.slice(0, 4);
  }

  return room.members.slice(0, 4);
}

/**
 * 채팅방 유형과 참여자 요약 정보를 반환한다.
 */
export function formatRoomMemberSummary(room: Room): string {
  const summary = `${getRoomTypeLabel(room.type)} · ${room.members.length}명`;

  if (room.type !== "GROUP") {
    return summary;
  }

  return `${summary} (${room.members.map((member) => member.displayName).join(", ")})`;
}

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
 * 내 채팅방 목록을 조회한다.
 */
export async function fetchRooms(): Promise<Room[] | null> {
  const token = await resolveAccessToken();

  if (!token) {
    return null;
  }

  const response = await apiFetch(`${getApiUrl()}/api/rooms`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) {
    if (handleUnauthorized(response)) {
      return null;
    }

    return [];
  }

  return response.json() as Promise<Room[]>;
}

/**
 * 채팅방 상세 정보를 조회한다.
 */
export async function fetchRoom(roomId: number): Promise<Room | null> {
  const token = await resolveAccessToken();

  if (!token) {
    return null;
  }

  const response = await apiFetch(`${getApiUrl()}/api/rooms/${roomId}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<Room>;
}

/**
 * 그룹 채팅방을 생성한다.
 */
export async function createGroupRoom(
  name: string,
  memberUserIds: number[] = [],
): Promise<Room | null> {
  const token = await resolveAccessToken();

  if (!token) {
    return null;
  }

  const response = await apiFetch(`${getApiUrl()}/api/rooms`, {
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
    const body = (await response.json()) as {
      message?: string;
      detail?: string;
      error?: string;
    };

    if (body.message) {
      return body.message;
    }

    if (body.detail) {
      return body.detail;
    }

    if (body.error) {
      return body.error;
    }
  } catch {
    // ignore parse errors
  }

  if (response.status === 404) {
    return "요청한 API를 찾을 수 없습니다. 서버를 재시작해 주세요.";
  }

  if (response.status === 403) {
    return "권한이 없습니다.";
  }

  return null;
}

/**
 * 1:1 DM 채팅방을 조회하거나 생성한다.
 */
export async function createDmRoom(
  targetUserId: number,
): Promise<{ room: Room | null; errorMessage: string | null }> {
  const token = await resolveAccessToken();

  if (!token) {
    return { room: null, errorMessage: "Authentication required" };
  }

  const response = await apiFetch(`${getApiUrl()}/api/rooms/dm`, {
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
  roomId: number,
  userId: number,
): Promise<{ room: Room | null; errorMessage: string | null }> {
  const token = await resolveAccessToken();

  if (!token) {
    return { room: null, errorMessage: "Authentication required" };
  }

  const response = await apiFetch(`${getApiUrl()}/api/rooms/${roomId}/members`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ userId }),
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
 * 채팅방 이름을 변경한다.
 */
export async function updateRoomName(
  roomId: number,
  name: string,
): Promise<{ room: Room | null; errorMessage: string | null }> {
  const token = await resolveAccessToken();

  if (!token) {
    return { room: null, errorMessage: "Authentication required" };
  }

  const response = await apiFetch(`${getApiUrl()}/api/rooms/${roomId}/name`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
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
 * 채팅방 메시지를 읽음 처리한다.
 */
export async function markRoomRead(roomId: number, messageId: number): Promise<boolean> {
  const token = await resolveAccessToken();

  if (!token) {
    return false;
  }

  const response = await apiFetch(`${getApiUrl()}/api/rooms/${roomId}/read`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ messageId }),
    cache: "no-store",
  });

  return response.ok;
}

/**
 * 채팅방 나가기/삭제 버튼 문구를 반환한다.
 */
export function getLeaveRoomLabel(room: Room, currentUserId: number): string {
  if (room.type === "GROUP") {
    return room.createdByUserId === currentUserId ? "방 삭제" : "방 나가기";
  }

  if (room.type === "SELF") {
    return "대화방 삭제";
  }

  return "채팅방 나가기";
}

/**
 * 채팅방 나가기 확인 문구를 반환한다.
 */
export function getLeaveRoomConfirmText(
  room: Room,
  currentUserId: number,
  displayName: string,
): { title: string; description: string; hint: string } {
  if (room.type === "GROUP" && room.createdByUserId === currentUserId) {
    return {
      title: "방 삭제",
      description: `${displayName} 채팅방을 삭제하시겠습니까?`,
      hint: "삭제하면 모든 참여자에게서 채팅방이 사라집니다.",
    };
  }

  if (room.type === "GROUP") {
    return {
      title: "방 나가기",
      description: `${displayName} 채팅방에서 나가시겠습니까?`,
      hint: "나가면 목록에서 채팅방이 제거됩니다.",
    };
  }

  if (room.type === "SELF") {
    return {
      title: "대화방 삭제",
      description: "나와의 대화방을 삭제하시겠습니까?",
      hint: "삭제 후에는 목록에서 제거됩니다.",
    };
  }

  return {
    title: "채팅방 나가기",
    description: `${displayName} 채팅방에서 나가시겠습니까?`,
    hint: "나가면 목록에서 채팅방이 제거됩니다.",
  };
}

/**
 * 채팅방을 삭제하거나 참여를 종료한다.
 */
export async function deleteRoom(roomId: number): Promise<boolean> {
  const token = await resolveAccessToken();

  if (!token) {
    return false;
  }

  const response = await apiFetch(`${getApiUrl()}/api/rooms/${roomId}`, {
    method: "DELETE",
    headers: authHeaders(token),
    cache: "no-store",
  });

  return response.ok;
}
