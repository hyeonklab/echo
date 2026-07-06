import { apiFetch, getApiUrl } from "@/lib/api";

export const ACCESS_TOKEN_KEY = "accessToken";
export const REFRESH_TOKEN_KEY = "refreshToken";

/** Naver OAuth 클라이언트 설정 완료 시 true로 변경한다. */
export const IS_NAVER_LOGIN_ENABLED = true;

export type AuthUser = {
  id: number;
  email: string | null;
  displayName: string;
  provider: "LOCAL" | "GOOGLE" | "NAVER";
  avatarFileId: number | null;
};

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
};

let pendingRefresh: Promise<string | null> | null = null;

/**
 * localStorage에서 access token을 읽는다.
 */
export function getAccessToken(): string | null {
  if (globalThis.window === undefined) {
    return null;
  }

  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * localStorage에서 refresh token을 읽는다.
 */
export function getRefreshToken(): string | null {
  if (globalThis.window === undefined) {
    return null;
  }

  return localStorage.getItem(REFRESH_TOKEN_KEY);
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
 * 서버 OAuth 세션을 정리하고 localStorage 토큰을 제거한다.
 */
export async function logout(): Promise<void> {
  try {
    await apiFetch(`${getApiUrl()}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // 네트워크 오류 시에도 로컬 토큰은 제거한다.
  }

  clearTokens();
}

/**
 * OAuth 일회용 교환 코드를 JWT로 교환한다.
 */
export async function exchangeAuthCode(code: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  const response = await apiFetch(`${getApiUrl()}/api/auth/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<{ accessToken: string; refreshToken: string }>;
}

/**
 * refresh token으로 access/refresh token을 재발급한다.
 */
export async function refreshAccessTokens(refreshToken: string): Promise<TokenResponse | null> {
  try {
    const response = await apiFetch(`${getApiUrl()}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return response.json() as Promise<TokenResponse>;
  } catch {
    return null;
  }
}

/**
 * 유효한 access token을 반환한다. 만료 시 refresh token으로 갱신한다.
 */
export async function ensureAccessToken(): Promise<string | null> {
  const accessToken = getAccessToken();

  if (accessToken) {
    const user = await fetchCurrentUser(accessToken);

    if (user) {
      return accessToken;
    }
  }

  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    clearTokens();
    return null;
  }

  if (!pendingRefresh) {
    pendingRefresh = refreshAndStore(refreshToken).finally(() => {
      pendingRefresh = null;
    });
  }

  return pendingRefresh;
}

/**
 * 세션 사용자 정보를 조회한다. access token 만료 시 자동 갱신한다.
 */
export async function fetchSessionUser(): Promise<AuthUser | null> {
  const accessToken = await ensureAccessToken();

  if (!accessToken) {
    return null;
  }

  return fetchCurrentUser(accessToken);
}

type RouterLike = {
  replace: (path: string) => void;
};

/**
 * 세션 사용자를 조회하고 없으면 토큰을 제거한 뒤 로그인 페이지로 이동한다.
 */
export async function requireSessionUser(router: RouterLike): Promise<AuthUser | null> {
  try {
    const user = await fetchSessionUser();

    if (!user) {
      clearTokens();
      router.replace("/login");
      return null;
    }

    return user;
  } catch {
    clearTokens();
    router.replace("/login");
    return null;
  }
}

/**
 * 401 응답이면 저장된 토큰을 제거한다.
 */
export function handleUnauthorized(response: Response): boolean {
  if (response.status !== 401) {
    return false;
  }

  clearTokens();
  return true;
}

async function refreshAndStore(refreshToken: string): Promise<string | null> {
  const tokens = await refreshAccessTokens(refreshToken);

  if (!tokens) {
    clearTokens();
    return null;
  }

  setTokens(tokens.accessToken, tokens.refreshToken);

  return tokens.accessToken;
}

/**
 * OAuth 로그인 URL을 반환한다.
 */
export function getOAuthLoginUrl(provider: "google" | "naver"): string {
  return `${getApiUrl()}/oauth2/authorization/${provider}`;
}

/**
 * 현재 로그인 사용자 정보를 조회한다.
 */
export async function fetchCurrentUser(token: string): Promise<AuthUser | null> {
  try {
    const response = await apiFetch(`${getApiUrl()}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return normalizeAuthUser((await response.json()) as AuthUser);
  } catch {
    return null;
  }
}

export function normalizeAuthUser(user: AuthUser): AuthUser {
  return {
    ...user,
    avatarFileId: user.avatarFileId ?? null,
  };
}
