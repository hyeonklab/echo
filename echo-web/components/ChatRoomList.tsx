"use client";

import Link from "next/link";
import { type SubmitEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AuthUser, fetchSessionUser } from "@/lib/auth";
import {
  Room,
  createDmRoom,
  createGroupRoom,
  deleteRoom,
  fetchRooms,
  formatLastMessagePreview,
  formatLastMessageTime,
  formatRoomMemberSummary,
  getRoomDisplayName,
} from "@/lib/rooms";
import { SearchUser, getProviderLabel, searchUsers } from "@/lib/users";
import { addFriend, fetchFriends, resolveAddFriendErrorMessage } from "@/lib/friends";
import { applyIncomingMessageToRooms, applyRoomReadToRooms, applyRoomUpdateToRooms, formatUnreadCount, getViewingRoomId, publishRoomsSnapshotEvent, subscribeRoomMessageEvents, subscribeRoomReadEvents, subscribeRoomUpdateEvents } from "@/lib/room-live";
import { getNotificationUnavailableReason } from "@/lib/notifications";

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
 * 채팅방 목록 및 생성 UI.
 */
type ChatRoomListProps = {
  mode?: "page" | "panel";
  activeRoomId?: number | null;
};

export default function ChatRoomList({ mode = "page", activeRoomId = null }: ChatRoomListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeleteRoom, setPendingDeleteRoom] = useState<Room | null>(null);
  const [friendIds, setFriendIds] = useState<Set<number>>(new Set());
  const notificationGuide = getNotificationUnavailableReason();

  useEffect(() => {
    async function loadRooms() {
      const user = await fetchSessionUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const roomList = await fetchRooms();
      const friendList = await fetchFriends();

      setCurrentUser(user);
      setRooms(roomList);
      publishRoomsSnapshotEvent(roomList);
      setFriendIds(new Set(friendList.map((friend) => friend.id)));
      setLoading(false);
    }

    loadRooms();
  }, [router]);

  useEffect(() => {
    const viewingRoomId = getViewingRoomId(pathname);

    return subscribeRoomMessageEvents((message) => {
      setRooms((prev) =>
        applyIncomingMessageToRooms(prev, message, {
          currentUserId: currentUser?.id,
          viewingRoomId,
        }),
      );
    });
  }, [currentUser?.id, pathname]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    return subscribeRoomReadEvents((read) => {
      setRooms((prev) => applyRoomReadToRooms(prev, read, currentUser.id));
    });
  }, [currentUser]);

  useEffect(() => {
    return subscribeRoomUpdateEvents((updatedRoom) => {
      setRooms((prev) => applyRoomUpdateToRooms(prev, updatedRoom));
    });
  }, []);

  async function handleCreateGroup(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!groupName.trim()) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const room = await createGroupRoom(groupName.trim());

    if (!room) {
      setErrorMessage("그룹 채팅방 생성에 실패했습니다.");
      setSubmitting(false);
      return;
    }

    setGroupName("");
    setRooms((prev) => {
      const next = [room, ...prev.filter((item) => item.id !== room.id)];
      publishRoomsSnapshotEvent(next);
      return next;
    });
    setSubmitting(false);
  }

  async function handleCreateSelfChat() {
    if (!currentUser) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const { room, errorMessage } = await createDmRoom(currentUser.id);

    if (!room) {
      setErrorMessage(resolveDmErrorMessage(errorMessage));
      setSubmitting(false);
      return;
    }

    setRooms((prev) => {
      const next = [room, ...prev.filter((item) => item.id !== room.id)];
      publishRoomsSnapshotEvent(next);
      return next;
    });
    setSubmitting(false);
    router.push(`/chat/${room.id}`);
  }

  async function handleSearchUsers(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = searchQuery.trim();

    if (trimmed.length < 2) {
      setErrorMessage("검색어는 2자 이상 입력해 주세요.");
      return;
    }

    setSearching(true);
    setErrorMessage(null);
    setSearchResults([]);

    const results = await searchUsers(trimmed);

    setSearchResults(results);
    setSearching(false);

    if (results.length === 0) {
      setErrorMessage("검색 결과가 없습니다.");
    }
  }

  async function handleStartDm(targetUser: SearchUser) {
    setSubmitting(true);
    setErrorMessage(null);

    const { room, errorMessage } = await createDmRoom(targetUser.id);

    if (!room) {
      setErrorMessage(resolveDmErrorMessage(errorMessage));
      setSubmitting(false);
      return;
    }

    setRooms((prev) => {
      const next = [room, ...prev.filter((item) => item.id !== room.id)];
      publishRoomsSnapshotEvent(next);
      return next;
    });
    setSubmitting(false);
    router.push(`/chat/${room.id}`);
  }

  async function handleAddFriend(targetUser: SearchUser) {
    if (friendIds.has(targetUser.id)) {
      setErrorMessage("이미 친구로 등록된 사용자입니다.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const { friend, errorMessage } = await addFriend(targetUser.id);

    if (!friend) {
      setErrorMessage(resolveAddFriendErrorMessage(errorMessage));
      setSubmitting(false);
      return;
    }

    setFriendIds((prev) => new Set([...prev, friend.id]));
    setSubmitting(false);
  }

  async function confirmDeleteRoom() {
    const roomId = pendingDeleteRoom?.id;

    if (roomId == null) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setPendingDeleteRoom(null);

    const deleted = await deleteRoom(roomId);

    if (!deleted) {
      setErrorMessage("채팅방 삭제에 실패했습니다.");
      setSubmitting(false);
      return;
    }

    setRooms((prev) => {
      const next = prev.filter((item) => item.id !== roomId);
      publishRoomsSnapshotEvent(next);
      return next;
    });
    setSubmitting(false);
  }

  function openDeleteConfirm(room: Room) {
    setPendingDeleteRoom(room);
  }

  function closeDeleteConfirm() {
    if (submitting) {
      return;
    }

    setPendingDeleteRoom(null);
  }

  if (loading) {
    return <p className="p-4 text-sm text-zinc-500">채팅방 목록 불러오는 중...</p>;
  }

  const isPanel = mode === "panel";

  const roomListSection = (
    <section className="space-y-2">
      <h2 className={`font-semibold text-zinc-900 dark:text-zinc-50 ${isPanel ? "text-sm" : "text-lg"}`}>
        내 채팅방
      </h2>

      {rooms.length === 0 ? (
        <p className="text-sm text-zinc-500">참여 중인 채팅방이 없습니다.</p>
      ) : (
        <ul className={isPanel ? "space-y-1" : "space-y-3"}>
          {rooms.map((room) => {
            const isActive = activeRoomId === room.id;
            const displayName = currentUser ? getRoomDisplayName(room, currentUser.id) : room.name;

            if (isPanel) {
              return (
                <li key={room.id}>
                  <Link
                    href={`/chat/${room.id}`}
                    className={`block rounded-lg px-3 py-2 transition ${
                      isActive
                        ? "bg-zinc-100 dark:bg-zinc-800"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                            {displayName}
                          </span>
                          {room.lastMessage ? (
                            <span className="shrink-0 text-[11px] text-zinc-400">
                              {formatLastMessageTime(room.lastMessage.createdAt)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-300">
                          {currentUser ? formatLastMessagePreview(room, currentUser.id) : "메시지가 없습니다."}
                        </p>
                      </div>
                      {room.unreadCount > 0 ? (
                        <span className="min-w-5 shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[11px] font-semibold text-white">
                          {formatUnreadCount(room.unreadCount ?? 0)}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            }

            return (
              <li
                key={room.id}
                className="relative rounded-xl border border-zinc-200 bg-zinc-50 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
              >
                <Link
                  href={`/chat/${room.id}`}
                  className="absolute inset-0 z-0 rounded-xl"
                  aria-label={`${displayName} 채팅방 열기`}
                />
                <div className="pointer-events-none relative z-10 flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                        {displayName}
                      </span>
                      {room.lastMessage ? (
                        <span className="shrink-0 text-[11px] text-zinc-400">
                          {formatLastMessageTime(room.lastMessage.createdAt)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-zinc-500">{formatRoomMemberSummary(room)}</p>
                    <p className="mt-2 truncate text-sm text-zinc-600 dark:text-zinc-300">
                      {currentUser ? formatLastMessagePreview(room, currentUser.id) : "메시지가 없습니다."}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {room.unreadCount > 0 ? (
                      <span className="min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[11px] font-semibold text-white">
                        {formatUnreadCount(room.unreadCount ?? 0)}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openDeleteConfirm(room)}
                      disabled={submitting}
                      className="pointer-events-auto rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const createSections = (
    <>
      {notificationGuide ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {notificationGuide}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className={`font-semibold text-zinc-900 dark:text-zinc-50 ${isPanel ? "text-sm" : "text-lg"}`}>
          그룹 채팅방 만들기
        </h2>
        <form className="flex flex-col gap-2" onSubmit={handleCreateGroup}>
          <input
            type="text"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="채팅방 이름"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting || !groupName.trim()}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            생성
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className={`font-semibold text-zinc-900 dark:text-zinc-50 ${isPanel ? "text-sm" : "text-lg"}`}>
          1:1 대화 시작
        </h2>
        {!isPanel ? (
          <p className="text-sm text-zinc-500">이름 또는 이메일로 사용자를 검색해 DM을 시작하세요.</p>
        ) : null}
        <form className="flex flex-col gap-2" onSubmit={handleSearchUsers}>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="이름 또는 이메일"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            disabled={submitting || searching}
          />
          <button
            type="submit"
            disabled={submitting || searching || searchQuery.trim().length < 2}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {searching ? "검색 중..." : "검색"}
          </button>
        </form>

        {searchResults.length > 0 ? (
          <ul className="space-y-2">
            {searchResults.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{user.displayName}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {user.email ?? "이메일 없음"} · {getProviderLabel(user.provider)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => handleAddFriend(user)}
                    disabled={submitting || friendIds.has(user.id)}
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {friendIds.has(user.id) ? "친구" : "추가"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartDm(user)}
                    disabled={submitting}
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    대화
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className={`font-semibold text-zinc-900 dark:text-zinc-50 ${isPanel ? "text-sm" : "text-lg"}`}>
          나와의 대화
        </h2>
        <button
          type="button"
          onClick={handleCreateSelfChat}
          disabled={submitting || !currentUser}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          나와의 대화 시작
        </button>
      </section>
    </>
  );

  return (
    <div className={isPanel ? "flex h-full flex-col overflow-hidden" : "space-y-8"}>
      {pendingDeleteRoom ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="삭제 확인 닫기"
            className="absolute inset-0 bg-black/50"
            onClick={closeDeleteConfirm}
            disabled={submitting}
          />
          <div
            role="alertdialog"
            aria-labelledby="delete-room-title"
            aria-describedby="delete-room-description"
            className="relative w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            <h3 id="delete-room-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              채팅방 삭제
            </h3>
            <p id="delete-room-description" className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {currentUser ? getRoomDisplayName(pendingDeleteRoom, currentUser.id) : pendingDeleteRoom.name}
              </span>
              {" "}채팅방을 삭제하시겠습니까?
            </p>
            <p className="mt-1 text-xs text-zinc-500">삭제 후에는 목록에서 제거됩니다.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={submitting}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmDeleteRoom}
                disabled={submitting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isPanel ? (
        <>
          <header className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">채팅</h1>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-4">
              {roomListSection}
              <details className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
                <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  새 채팅 만들기
                </summary>
                <div className="mt-3 space-y-4">{createSections}</div>
              </details>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-8">
          {createSections}
          {roomListSection}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              홈으로
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
