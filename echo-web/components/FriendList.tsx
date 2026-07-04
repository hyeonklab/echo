"use client";

import { type SubmitEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import OnlineStatusDot from "@/components/OnlineStatusDot";
import { AuthUser, fetchSessionUser } from "@/lib/auth";
import {
  Friend,
  addFriend,
  fetchFriends,
  removeFriend,
  resolveAddFriendErrorMessage,
} from "@/lib/friends";
import {
  applyPresenceUpdate,
  fetchOnlineUserIds,
  getOnlineStatusLabel,
  subscribePresenceSnapshots,
  subscribePresenceUpdates,
} from "@/lib/presence";
import { createDmRoom } from "@/lib/rooms";
import { SearchUser, searchUsers } from "@/lib/users";

/**
 * DM 생성 API 오류 메시지를 사용자 메시지로 변환한다.
 */
function resolveDmErrorMessage(errorMessage: string | null): string {
  if (!errorMessage) {
    return "DM 채팅방 생성에 실패했습니다.";
  }

  if (errorMessage.includes("User not found")) {
    return "사용자를 찾을 수 없습니다.";
  }

  return errorMessage;
}

/**
 * 친구 목록 및 추가 UI.
 */
export default function FriendList() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeleteFriend, setPendingDeleteFriend] = useState<Friend | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());

  const friendIdSet = useMemo(() => new Set(friends.map((friend) => friend.id)), [friends]);
  const onlineFriendCount = useMemo(
    () => friends.filter((friend) => onlineUserIds.has(friend.id)).length,
    [friends, onlineUserIds],
  );

  useEffect(() => {
    async function loadFriends() {
      const user = await fetchSessionUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const [friendList, onlineIds] = await Promise.all([fetchFriends(), fetchOnlineUserIds()]);

      setCurrentUser(user);
      setFriends(friendList);
      setOnlineUserIds(onlineIds);
      setLoading(false);
    }

    loadFriends();
  }, [router]);

  useEffect(() => {
    const unsubscribeSnapshot = subscribePresenceSnapshots((snapshot) => {
      setOnlineUserIds(snapshot);
    });

    const unsubscribeUpdate = subscribePresenceUpdates((update) => {
      setOnlineUserIds((prev) => applyPresenceUpdate(prev, update));
    });

    return () => {
      unsubscribeSnapshot();
      unsubscribeUpdate();
    };
  }, []);

  async function handleSearchUsers(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSearching(true);

    const results = await searchUsers(searchQuery);

    setSearchResults(results);
    setSearching(false);
  }

  async function handleAddFriend(user: SearchUser) {
    if (friendIdSet.has(user.id)) {
      setErrorMessage("이미 친구로 등록된 사용자입니다.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const { friend, errorMessage: apiError } = await addFriend(user.id);

    if (!friend) {
      setErrorMessage(resolveAddFriendErrorMessage(apiError));
      setSubmitting(false);
      return;
    }

    setFriends((prev) => [friend, ...prev.filter((item) => item.id !== friend.id)]);
    setSearchResults((prev) => prev.filter((item) => item.id !== user.id));
    setSubmitting(false);
  }

  async function handleStartDm(friend: Friend) {
    setSubmitting(true);
    setErrorMessage(null);

    const { room, errorMessage: apiError } = await createDmRoom(friend.id);

    if (!room) {
      setErrorMessage(resolveDmErrorMessage(apiError));
      setSubmitting(false);
      return;
    }

    router.push(`/chat/${room.id}`);
  }

  async function handleCreateSelfChat() {
    if (!currentUser) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const { room, errorMessage: apiError } = await createDmRoom(currentUser.id);

    if (!room) {
      setErrorMessage(resolveDmErrorMessage(apiError));
      setSubmitting(false);
      return;
    }

    router.push(`/chat/${room.id}`);
  }

  async function handleConfirmDeleteFriend() {
    if (!pendingDeleteFriend) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const { success, errorMessage: apiError } = await removeFriend(pendingDeleteFriend.id);

    if (!success) {
      setErrorMessage(apiError ?? "친구 삭제에 실패했습니다.");
      setSubmitting(false);
      return;
    }

    setFriends((prev) => prev.filter((friend) => friend.id !== pendingDeleteFriend.id));
    setPendingDeleteFriend(null);
    setSubmitting(false);
  }

  if (loading) {
    return <p className="p-4 text-sm text-zinc-500">친구 목록 불러오는 중...</p>;
  }

  const isSelfOnline = currentUser ? onlineUserIds.has(currentUser.id) : false;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">친구</h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          친구 {friends.length} · 온라인 {onlineFriendCount}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="w-full max-w-xl space-y-4">
          {errorMessage ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {errorMessage}
            </p>
          ) : null}

          <section className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
            <h2 className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50">
              친구 목록
            </h2>

            <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {currentUser ? (
                <li className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
                    {currentUser.displayName.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      <OnlineStatusDot online={isSelfOnline} />
                      <span className="truncate">{currentUser.displayName}</span>
                      <span className="text-xs font-normal text-zinc-400">나</span>
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      <span className={isSelfOnline ? "text-emerald-600 dark:text-emerald-400" : ""}>
                        {getOnlineStatusLabel(isSelfOnline)}
                      </span>
                      {currentUser.email ? ` · ${currentUser.email}` : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateSelfChat}
                    disabled={submitting}
                    className="shrink-0 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    나와의 대화
                  </button>
                </li>
              ) : null}

              {friends.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-zinc-500">아직 등록된 친구가 없습니다.</li>
              ) : (
                friends.map((friend) => {
                  const isOnline = onlineUserIds.has(friend.id);

                  return (
                    <li key={friend.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
                        {friend.displayName.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          <OnlineStatusDot online={isOnline} />
                          <span className="truncate">{friend.displayName}</span>
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          <span className={isOnline ? "text-emerald-600 dark:text-emerald-400" : ""}>
                            {getOnlineStatusLabel(isOnline)}
                          </span>
                          {friend.email ? ` · ${friend.email}` : null}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartDm(friend)}
                          disabled={submitting}
                          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          대화
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteFriend(friend)}
                          disabled={submitting}
                          className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                        >
                          삭제
                        </button>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <details className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">
              친구 추가
            </summary>
            <div className="space-y-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <form className="flex gap-2" onSubmit={handleSearchUsers}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="이름 또는 이메일"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                  disabled={submitting || searching}
                />
                <button
                  type="submit"
                  disabled={submitting || searching || searchQuery.trim().length < 2}
                  className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {searching ? "검색 중..." : "검색"}
                </button>
              </form>

              {searchResults.length > 0 ? (
                <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
                  {searchResults.map((user) => {
                    const isFriend = friendIdSet.has(user.id);

                    return (
                      <li key={user.id} className="flex items-center gap-3 bg-white px-3 py-2 dark:bg-zinc-900">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{user.displayName}</p>
                          <p className="truncate text-xs text-zinc-500">{user.email ?? "이메일 없음"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddFriend(user)}
                          disabled={submitting || isFriend}
                          className="shrink-0 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          {isFriend ? "추가됨" : "추가"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </details>

          {pendingDeleteFriend ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {pendingDeleteFriend.displayName}님을 친구 목록에서 삭제할까요?
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingDeleteFriend(null)}
                    disabled={submitting}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteFriend}
                    disabled={submitting}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
