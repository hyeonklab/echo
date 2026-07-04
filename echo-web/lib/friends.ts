import { ensureAccessToken } from "@/lib/auth";
import { apiFetch, getApiUrl } from "@/lib/api";

export type Friend = {
  id: number;
  email: string | null;
  displayName: string;
  provider: "LOCAL" | "GOOGLE" | "NAVER";
  addedAt: string;
  online: boolean;
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
 * API 오류 메시지를 파싱한다.
 */
async function readApiErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };

    if (body.message) {
      return body.message;
    }
  } catch {
    // ignore parse errors
  }

  return `Request failed (${response.status})`;
}

/**
 * 내 친구 목록을 조회한다.
 */
export async function fetchFriends(): Promise<Friend[]> {
  const token = await resolveAccessToken();

  if (!token) {
    return [];
  }

  const response = await apiFetch(`${getApiUrl()}/api/friends`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  return response.json() as Promise<Friend[]>;
}

/**
 * 친구를 추가한다.
 */
export async function addFriend(
  targetUserId: number,
): Promise<{ friend: Friend | null; errorMessage: string | null }> {
  const token = await resolveAccessToken();

  if (!token) {
    return { friend: null, errorMessage: "Authentication required" };
  }

  const response = await apiFetch(`${getApiUrl()}/api/friends`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ targetUserId }),
    cache: "no-store",
  });

  if (!response.ok) {
    return { friend: null, errorMessage: await readApiErrorMessage(response) };
  }

  return {
    friend: (await response.json()) as Friend,
    errorMessage: null,
  };
}

/**
 * 친구를 삭제한다.
 */
export async function removeFriend(
  friendUserId: number,
): Promise<{ success: boolean; errorMessage: string | null }> {
  const token = await resolveAccessToken();

  if (!token) {
    return { success: false, errorMessage: "Authentication required" };
  }

  const response = await apiFetch(`${getApiUrl()}/api/friends/${friendUserId}`, {
    method: "DELETE",
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) {
    return { success: false, errorMessage: await readApiErrorMessage(response) };
  }

  return { success: true, errorMessage: null };
}

/**
 * 친구 추가 API 오류 메시지를 사용자 메시지로 변환한다.
 */
export function resolveAddFriendErrorMessage(errorMessage: string | null): string {
  if (!errorMessage) {
    return "친구 추가에 실패했습니다.";
  }

  if (errorMessage.includes("Cannot add yourself")) {
    return "자기 자신은 친구로 추가할 수 없습니다.";
  }

  if (errorMessage.includes("Friend already exists")) {
    return "이미 친구로 등록된 사용자입니다.";
  }

  if (errorMessage.includes("User not found")) {
    return "사용자를 찾을 수 없습니다.";
  }

  return errorMessage;
}

/**
 * 친구 추가 시각을 표시 형식으로 변환한다.
 */
export function formatFriendAddedAt(value: string): string {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
