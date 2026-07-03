const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export const ACCESS_TOKEN_KEY = "accessToken";
export const REFRESH_TOKEN_KEY = "refreshToken";

export type AuthUser = {
  id: number;
  email: string | null;
  displayName: string;
  provider: "LOCAL" | "GOOGLE" | "NAVER";
};

/**
 * localStorage에서 access token을 읽는다.
 */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * access/refresh token을 localStorage에 저장한다.
 */
export function setTokens(accessToken: string, refreshToken?: string | null): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);

  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

/**
 * 저장된 인증 토큰을 제거한다.
 */
export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * OAuth 로그인 URL을 반환한다.
 */
export function getOAuthLoginUrl(provider: "google" | "naver"): string {
  return `${API_URL}/oauth2/authorization/${provider}`;
}

/**
 * 현재 로그인 사용자 정보를 조회한다.
 */
export async function fetchCurrentUser(token: string): Promise<AuthUser | null> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<AuthUser>;
}
