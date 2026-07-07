"use client";

import Link from "next/link";
import { type MouseEvent, type SubmitEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AuthUser, requireSessionUser } from "@/lib/auth";
import RoomAvatar from "@/components/RoomAvatar";
import {
  Room,
  canRenameRoom,
  createDmRoom,
  createGroupRoom,
  deleteRoom,
  fetchRooms,
  formatLastMessagePreview,
  formatLastMessageTime,
  formatRoomMemberSummary,
  getRoomDisplayName,
  getLeaveRoomLabel,
  getLeaveRoomConfirmText,
  requiresDmLeaveScopeChoice,
  resolveRoomDeleteScope,
  updateRoomName,
  type RoomDeleteScope,
} from "@/lib/rooms";
import { SearchUser, getProviderLabel, searchUsers } from "@/lib/users";
import {
  Friend,
  addFriend,
  fetchFriends,
  resolveAddFriendErrorMessage,
  resolveUpdateFriendNicknameErrorMessage,
  updateFriendNickname,
} from "@/lib/friends";
import { applyIncomingMessageToRooms, applyMessageDeletedToRooms, applyRoomMembershipToRooms, applyRoomReadToRooms, applyRoomUpdateToRooms, formatUnreadCount, getViewingRoomId, publishRoomLeftEvent, publishRoomUpdateEvent, publishRoomsSnapshotEvent, subscribeRoomMessageDeletedEvents, subscribeRoomMessageEvents, subscribeRoomLeftEvents, subscribeRoomReadEvents, subscribeRoomUpdateEvents, subscribeRoomsSnapshotEvents } from "@/lib/room-live";
import { subscribeUserRoomDeleted, subscribeUserRoomMembership } from "@/lib/stomp";
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
 * 채팅방 이름 변경 API 오류 메시지를 사용자 메시지로 변환한다.
 */
function resolveRenameErrorMessage(errorMessage: string | null): string {
  if (!errorMessage) {
    return "채팅방 이름 변경에 실패했습니다.";
  }

  if (errorMessage.includes("Cannot rename a DM room")) {
    return "1:1 DM 채팅방은 이름을 변경할 수 없습니다.";
  }

  return errorMessage;
}

/**
 * DM 상대 사용자 ID를 반환한다.
 */
function getDmPeerUserId(room: Room, currentUserId: number): number | null {
  if (room.type !== "DM") {
    return null;
  }

  const peer = room.members.find((member) => member.userId !== currentUserId);

  return peer?.userId ?? null;
}

type RoomContextMenuState = {
  x: number;
  y: number;
  room: Room;
};

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
  const [pendingLeaveRoom, setPendingLeaveRoom] = useState<{
    room: Room;
    step: "dm-choice" | "confirm";
    scope?: RoomDeleteScope;
  } | null>(null);
  const [friendIds, setFriendIds] = useState<Set<number>>(new Set());
  const [friendsById, setFriendsById] = useState<Map<number, Friend>>(new Map());
  const [roomContextMenu, setRoomContextMenu] = useState<RoomContextMenuState | null>(null);
  const [pendingRoomRename, setPendingRoomRename] = useState<Room | null>(null);
  const [roomRenameInput, setRoomRenameInput] = useState("");
  const [roomRenameErrorMessage, setRoomRenameErrorMessage] = useState<string | null>(null);
  const [pendingNicknameFriend, setPendingNicknameFriend] = useState<Friend | null>(null);
  const [nicknameInput, setNicknameInput] = useState("");
  const [nicknameErrorMessage, setNicknameErrorMessage] = useState<string | null>(null);
  const notificationGuide = getNotificationUnavailableReason();

  useEffect(() => {
    async function loadRooms() {
      try {
        const user = await requireSessionUser(router);

        if (!user) {
          return;
        }

        const roomList = await fetchRooms();
        const friendList = await fetchFriends();

        if (roomList === null || friendList === null) {
          router.replace("/login");
          return;
        }

        setCurrentUser(user);
        setRooms(roomList);
        publishRoomsSnapshotEvent(roomList);
        setFriendsById(new Map(friendList.map((friend) => [friend.id, friend])));
        setFriendIds(new Set(friendList.map((friend) => friend.id)));
      } finally {
        setLoading(false);
      }
    }

    void loadRooms();
  }, [router]);

  useEffect(() => {
    if (!roomContextMenu) {
      return;
    }

    function closeContextMenu() {
      setRoomContextMenu(null);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    }

    window.addEventListener("click", closeContextMenu);
    window.addEventListener("scroll", closeContextMenu, true);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("click", closeContextMenu);
      window.removeEventListener("scroll", closeContextMenu, true);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [roomContextMenu]);

  useEffect(() => {
    return subscribeRoomsSnapshotEvents((snapshot) => {
      queueMicrotask(() => {
        setRooms(snapshot);
      });
    });
  }, []);

  useEffect(() => {
    return subscribeRoomLeftEvents((roomId) => {
      queueMicrotask(() => {
        setRooms((prev) => {
          const next = prev.filter((room) => room.id !== roomId);
          publishRoomsSnapshotEvent(next);

          return next;
        });
      });
    });
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    return subscribeUserRoomDeleted(currentUser.id, (deleted) => {
      setRooms((prev) => {
        const next = prev.filter((room) => room.id !== deleted.roomId);
        publishRoomsSnapshotEvent(next);

        return next;
      });
      publishRoomLeftEvent(deleted.roomId);
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    return subscribeUserRoomMembership(currentUser.id, (room) => {
      setRooms((prev) => {
        const next = applyRoomMembershipToRooms(prev, room);
        publishRoomsSnapshotEvent(next);

        return next;
      });
    });
  }, [currentUser]);

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
    return subscribeRoomMessageDeletedEvents((deleted) => {
      setRooms((prev) => applyMessageDeletedToRooms(prev, deleted));
    });
  }, []);

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
    setFriendsById((prev) => new Map(prev).set(friend.id, friend));
    setSubmitting(false);
  }

  async function confirmDeleteRoom() {
    if (!pendingLeaveRoom || pendingLeaveRoom.step !== "confirm") {
      return;
    }

    const { room, scope = "me" } = pendingLeaveRoom;
    const roomId = room.id;
    const deleteScope = resolveRoomDeleteScope(room, scope);

    setSubmitting(true);
    setErrorMessage(null);
    setPendingLeaveRoom(null);

    const deleted = await deleteRoom(roomId, deleteScope);

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
    publishRoomLeftEvent(roomId);
    setSubmitting(false);

    if (activeRoomId === roomId) {
      router.push("/chat");
    }
  }

  function openDeleteConfirm(room: Room) {
    if (requiresDmLeaveScopeChoice(room)) {
      setPendingLeaveRoom({ room, step: "dm-choice" });
      return;
    }

    setPendingLeaveRoom({ room, step: "confirm", scope: "me" });
  }

  function closeDeleteConfirm() {
    if (submitting) {
      return;
    }

    setPendingLeaveRoom(null);
  }

  function selectLeaveScope(scope: RoomDeleteScope) {
    if (!pendingLeaveRoom) {
      return;
    }

    setPendingLeaveRoom({ ...pendingLeaveRoom, step: "confirm", scope });
  }

  function handleRoomContextMenu(event: MouseEvent, room: Room) {
    event.preventDefault();
    event.stopPropagation();
    setRoomContextMenu({ x: event.clientX, y: event.clientY, room });
  }

  function openRoomRenameModal(room: Room) {
    setRoomContextMenu(null);
    setRoomRenameErrorMessage(null);
    setRoomRenameInput(room.name);
    setPendingRoomRename(room);
  }

  function openFriendNicknameModal(room: Room) {
    if (!currentUser) {
      return;
    }

    const peerUserId = getDmPeerUserId(room, currentUser.id);

    if (peerUserId == null) {
      return;
    }

    const friend = friendsById.get(peerUserId);

    if (!friend) {
      return;
    }

    setRoomContextMenu(null);
    setPendingNicknameFriend(friend);
    setNicknameInput(friend.nickname ?? "");
    setNicknameErrorMessage(null);
  }

  async function handleConfirmRoomRename(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pendingRoomRename) {
      return;
    }

    const trimmed = roomRenameInput.trim();

    if (!trimmed) {
      return;
    }

    if (trimmed === pendingRoomRename.name) {
      setPendingRoomRename(null);
      setRoomRenameInput("");
      return;
    }

    setSubmitting(true);
    setRoomRenameErrorMessage(null);

    const { room: updatedRoom, errorMessage: apiError } = await updateRoomName(pendingRoomRename.id, trimmed);

    if (!updatedRoom) {
      setRoomRenameErrorMessage(resolveRenameErrorMessage(apiError));
      setSubmitting(false);
      return;
    }

    setRooms((prev) => applyRoomUpdateToRooms(prev, updatedRoom));
    publishRoomUpdateEvent(updatedRoom);
    setPendingRoomRename(null);
    setRoomRenameInput("");
    setSubmitting(false);
  }

  async function handleConfirmFriendNickname() {
    if (!pendingNicknameFriend) {
      return;
    }

    setSubmitting(true);
    setNicknameErrorMessage(null);

    const { friend, errorMessage: apiError } = await updateFriendNickname(
      pendingNicknameFriend.id,
      nicknameInput,
    );

    if (!friend) {
      setNicknameErrorMessage(resolveUpdateFriendNicknameErrorMessage(apiError));
      setSubmitting(false);
      return;
    }

    setFriendsById((prev) => new Map(prev).set(friend.id, friend));

    const refreshedRooms = await fetchRooms();

    if (refreshedRooms) {
      setRooms(refreshedRooms);
      publishRoomsSnapshotEvent(refreshedRooms);
    }

    setPendingNicknameFriend(null);
    setNicknameInput("");
    setSubmitting(false);
  }

  function handleLeaveRoomFromMenu(room: Room) {
    setRoomContextMenu(null);
    openDeleteConfirm(room);
  }

  if (loading) {
    return <p className="p-4 text-sm text-zinc-500">채팅방 목록 불러오는 중...</p>;
  }

  if (!currentUser) {
    return <p className="p-4 text-sm text-zinc-500">로그인 페이지로 이동 중...</p>;
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
                <li key={room.id} onContextMenu={(event) => handleRoomContextMenu(event, room)}>
                  <Link
                    href={`/chat/${room.id}`}
                    className={`block rounded-lg px-3 py-2 transition ${
                      isActive
                        ? "bg-zinc-100 dark:bg-zinc-800"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {currentUser ? (
                        <RoomAvatar
                          room={room}
                          currentUserId={currentUser.id}
                          className="h-10 w-10 shrink-0"
                          textClassName="text-xs font-semibold"
                        />
                      ) : null}
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
                onContextMenu={(event) => handleRoomContextMenu(event, room)}
              >
                <Link
                  href={`/chat/${room.id}`}
                  className="absolute inset-0 z-0 rounded-xl"
                  aria-label={`${displayName} 채팅방 열기`}
                />
                <div className="pointer-events-none relative z-10 flex items-start gap-3 p-4">
                  {currentUser ? (
                    <RoomAvatar
                      room={room}
                      currentUserId={currentUser.id}
                      className="h-12 w-12 shrink-0"
                    />
                  ) : null}
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
                      {currentUser ? getLeaveRoomLabel(room, currentUser.id) : "삭제"}
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

  const leaveRoomConfirm = pendingLeaveRoom?.step === "confirm" && currentUser
    ? getLeaveRoomConfirmText(
      pendingLeaveRoom.room,
      currentUser.id,
      getRoomDisplayName(pendingLeaveRoom.room, currentUser.id),
      pendingLeaveRoom.scope ?? "me",
    )
    : null;
  const leaveRoomDisplayName = pendingLeaveRoom && currentUser
    ? getRoomDisplayName(pendingLeaveRoom.room, currentUser.id)
    : "";
  const contextMenuRoom = roomContextMenu?.room ?? null;
  const contextMenuPeerUserId =
    contextMenuRoom && currentUser ? getDmPeerUserId(contextMenuRoom, currentUser.id) : null;
  const contextMenuFriend =
    contextMenuPeerUserId != null ? friendsById.get(contextMenuPeerUserId) : undefined;

  return (
    <div className={isPanel ? "flex h-full flex-col overflow-hidden" : "space-y-8"}>
      {roomContextMenu && contextMenuRoom && currentUser ? (
        <div
          className="fixed z-50 min-w-[180px] overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
          style={{ left: roomContextMenu.x, top: roomContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          {canRenameRoom(contextMenuRoom.type) ? (
            <button
              type="button"
              onClick={() => openRoomRenameModal(contextMenuRoom)}
              className="block w-full px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              채팅방 이름 변경
            </button>
          ) : null}
          {contextMenuRoom.type === "DM" && contextMenuFriend ? (
            <button
              type="button"
              onClick={() => openFriendNicknameModal(contextMenuRoom)}
              className="block w-full px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              친구 이름 변경
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => handleLeaveRoomFromMenu(contextMenuRoom)}
            disabled={submitting}
            className="block w-full px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            {getLeaveRoomLabel(contextMenuRoom, currentUser.id)}
          </button>
        </div>
      ) : null}

      {pendingRoomRename ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="채팅방 이름 변경 닫기"
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (submitting) {
                return;
              }

              setPendingRoomRename(null);
              setRoomRenameInput("");
              setRoomRenameErrorMessage(null);
            }}
            disabled={submitting}
          />
          <form
            role="dialog"
            aria-labelledby="room-rename-title"
            className="relative w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onSubmit={(event) => void handleConfirmRoomRename(event)}
          >
            <h3 id="room-rename-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              채팅방 이름 변경
            </h3>
            <input
              type="text"
              value={roomRenameInput}
              onChange={(event) => {
                setRoomRenameInput(event.target.value);
                setRoomRenameErrorMessage(null);
              }}
              placeholder="채팅방 이름"
              maxLength={255}
              className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              disabled={submitting}
              autoFocus
            />
            {roomRenameErrorMessage ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{roomRenameErrorMessage}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingRoomRename(null);
                  setRoomRenameInput("");
                  setRoomRenameErrorMessage(null);
                }}
                disabled={submitting}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting || !roomRenameInput.trim()}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {submitting ? "저장 중..." : "저장"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {pendingNicknameFriend ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="친구 이름 변경 닫기"
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (submitting) {
                return;
              }

              setPendingNicknameFriend(null);
              setNicknameInput("");
              setNicknameErrorMessage(null);
            }}
            disabled={submitting}
          />
          <div
            role="dialog"
            aria-labelledby="friend-nickname-title"
            className="relative w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            <h3 id="friend-nickname-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              친구 이름 변경
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              원래 이름: {pendingNicknameFriend.displayName}
            </p>
            <input
              type="text"
              value={nicknameInput}
              onChange={(event) => {
                setNicknameInput(event.target.value);
                setNicknameErrorMessage(null);
              }}
              placeholder="비우면 원래 이름으로 표시"
              maxLength={255}
              className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              disabled={submitting}
              autoFocus
            />
            {nicknameErrorMessage ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{nicknameErrorMessage}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingNicknameFriend(null);
                  setNicknameInput("");
                  setNicknameErrorMessage(null);
                }}
                disabled={submitting}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmFriendNickname()}
                disabled={submitting}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {submitting ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingLeaveRoom?.step === "dm-choice" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="삭제 방식 선택 닫기"
            className="absolute inset-0 bg-black/50"
            onClick={closeDeleteConfirm}
            disabled={submitting}
          />
          <div
            role="dialog"
            aria-labelledby="delete-room-choice-title"
            className="relative w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            <h3 id="delete-room-choice-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              채팅방 삭제
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {leaveRoomDisplayName}과(와)의 채팅방을 어떻게 삭제할까요?
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => selectLeaveScope("me")}
                disabled={submitting}
                className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-left transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">나만 삭제</span>
                <span className="mt-1 block text-xs text-zinc-500">
                  내 목록에서만 숨깁니다. 상대방에게는 계속 보입니다.
                </span>
              </button>
              <button
                type="button"
                onClick={() => selectLeaveScope("all")}
                disabled={submitting}
                className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-left transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/40 dark:hover:bg-red-950/70"
              >
                <span className="block text-sm font-medium text-red-800 dark:text-red-200">양쪽 모두 삭제</span>
                <span className="mt-1 block text-xs text-red-700 dark:text-red-300">
                  상대방도 채팅방에서 완전히 삭제됩니다.
                </span>
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={submitting}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingLeaveRoom?.step === "confirm" && leaveRoomConfirm ? (
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
            className={`relative w-full max-w-sm rounded-xl border bg-white p-5 shadow-xl dark:bg-zinc-900 ${
              leaveRoomConfirm.isDestructive
                ? "border-red-300 dark:border-red-900"
                : "border-zinc-200 dark:border-zinc-700"
            }`}
          >
            <h3 id="delete-room-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {leaveRoomConfirm.title}
            </h3>
            <p id="delete-room-description" className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {leaveRoomConfirm.description}
            </p>
            <p
              className={`mt-2 rounded-lg px-3 py-2 text-xs ${
                leaveRoomConfirm.isDestructive
                  ? "border border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
                  : "text-zinc-500"
              }`}
            >
              {leaveRoomConfirm.hint}
            </p>
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
                onClick={() => void confirmDeleteRoom()}
                disabled={submitting}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 ${
                  leaveRoomConfirm.isDestructive
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                }`}
              >
                {submitting ? "처리 중..." : leaveRoomConfirm.confirmLabel}
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
          <div className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <details className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
              <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-200">
                새 채팅 만들기
              </summary>
              <div className="mt-3 space-y-4">{createSections}</div>
            </details>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {roomListSection}
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
