import { ensureAccessToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type SearchUser = {
  id: number;
  email: string | null;
  displayName: string;
  provider: "LOCAL" | "GOOGLE" | "NAVER";
};

/**
 * OAuth 제공자 라벨을 반환한다.
 */
export function getProviderLabel(provider: SearchUser["provider"]): string {
  if (provider === "GOOGLE") {
    return "Google";
  }

  if (provider === "NAVER") {
    return "Naver";
  }

  return "로컬";
}

/**
 * 인증 헤더를 구성한다.
 */
function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * API 호출용 access token을 확보한다.
 */
async function resolveAccessToken(): Promise<string | null> {
  return ensureAccessToken();
}

/**
 * 이름 또는 이메일로 사용자를 검색한다.
 */
export async function searchUsers(keyword: string): Promise<SearchUser[]> {
  const token = await resolveAccessToken();

  if (!token) {
    return [];
  }

  const trimmed = keyword.trim();

  if (trimmed.length < 2) {
    return [];
  }

  const params = new URLSearchParams({ q: trimmed });
  const response = await fetch(`${API_URL}/api/users/search?${params.toString()}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  return response.json() as Promise<SearchUser[]>;
}
