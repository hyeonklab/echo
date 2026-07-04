"use client";

import { useCallback, useEffect, useState } from "react";

import { getAccessToken } from "@/lib/auth";
import {
  fetchOnlineUserIds,
  publishPresenceSnapshot,
  publishPresenceUpdate,
} from "@/lib/presence";
import { subscribePresenceUpdates } from "@/lib/stomp";

/**
 * 로그인 사용자의 온라인 상태를 구독하고 앱 전역 이벤트로 전파한다.
 */
export default function PresenceListener() {
  const [enabled, setEnabled] = useState(false);

  const loadPresenceSnapshot = useCallback(async () => {
    const token = getAccessToken();

    if (!token) {
      setEnabled(false);
      return;
    }

    const onlineUserIds = await fetchOnlineUserIds();

    publishPresenceSnapshot(onlineUserIds);
    setEnabled(true);
  }, []);

  useEffect(() => {
    void loadPresenceSnapshot();

    function handleVisibilityChange() {
      if (globalThis.document.visibilityState === "visible") {
        void loadPresenceSnapshot();
      }
    }

    globalThis.window.addEventListener("focus", loadPresenceSnapshot);
    globalThis.document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      globalThis.window.removeEventListener("focus", loadPresenceSnapshot);
      globalThis.document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadPresenceSnapshot]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    return subscribePresenceUpdates((update) => {
      publishPresenceUpdate(update);
    });
  }, [enabled]);

  return null;
}
