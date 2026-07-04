import { ensureAccessToken } from "@/lib/auth";
import { apiFetch, getApiUrl } from "@/lib/api";

export type PresenceUpdate = {
  userId: number;
  online: boolean;
};

export const PRESENCE_EVENT = "echo:presence-update";
export const PRESENCE_SNAPSHOT_EVENT = "echo:presence-snapshot";

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
 * 현재 온라인 사용자 ID 목록을 조회한다.
 */
export async function fetchOnlineUserIds(): Promise<Set<number>> {
  const token = await resolveAccessToken();

  if (!token) {
    return new Set();
  }

  const response = await apiFetch(`${getApiUrl()}/api/presence/online`, {
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) {
    return new Set();
  }

  const userIds = (await response.json()) as number[];

  return new Set(userIds);
}

/**
 * 온라인 상태 변경 이벤트를 발행한다.
 */
export function publishPresenceUpdate(update: PresenceUpdate): void {
  if (globalThis.window === undefined) {
    return;
  }

  globalThis.window.dispatchEvent(
    new CustomEvent<PresenceUpdate>(PRESENCE_EVENT, { detail: update }),
  );
}

/**
 * 온라인 사용자 스냅샷 이벤트를 발행한다.
 */
export function publishPresenceSnapshot(onlineUserIds: Set<number>): void {
  if (globalThis.window === undefined) {
    return;
  }

  globalThis.window.dispatchEvent(
    new CustomEvent<number[]>(PRESENCE_SNAPSHOT_EVENT, {
      detail: [...onlineUserIds],
    }),
  );
}

/**
 * 온라인 상태 변경 이벤트를 구독한다.
 */
export function subscribePresenceUpdates(handler: (update: PresenceUpdate) => void): () => void {
  function onPresenceUpdate(event: Event) {
    handler((event as CustomEvent<PresenceUpdate>).detail);
  }

  globalThis.window.addEventListener(PRESENCE_EVENT, onPresenceUpdate);

  return () => {
    globalThis.window.removeEventListener(PRESENCE_EVENT, onPresenceUpdate);
  };
}

/**
 * 온라인 사용자 스냅샷 이벤트를 구독한다.
 */
export function subscribePresenceSnapshots(handler: (onlineUserIds: Set<number>) => void): () => void {
  function onPresenceSnapshot(event: Event) {
    handler(new Set((event as CustomEvent<number[]>).detail));
  }

  globalThis.window.addEventListener(PRESENCE_SNAPSHOT_EVENT, onPresenceSnapshot);

  return () => {
    globalThis.window.removeEventListener(PRESENCE_SNAPSHOT_EVENT, onPresenceSnapshot);
  };
}

/**
 * 사용자 온라인 여부를 반환한다.
 */
export function isUserOnline(onlineUserIds: Set<number>, userId: number): boolean {
  return onlineUserIds.has(userId);
}

/**
 * 온라인 상태 변경을 반영한다.
 */
export function applyPresenceUpdate(
  onlineUserIds: Set<number>,
  update: PresenceUpdate,
): Set<number> {
  const next = new Set(onlineUserIds);

  if (update.online) {
    next.add(update.userId);
  } else {
    next.delete(update.userId);
  }

  return next;
}

/**
 * 온라인 상태 라벨을 반환한다.
 */
export function getOnlineStatusLabel(online: boolean): string {
  if (online) {
    return "온라인";
  }

  return "오프라인";
}
