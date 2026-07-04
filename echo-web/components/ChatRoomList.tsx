"use client";

import Link from "next/link";
import { type SubmitEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
export default function ChatRoomList() {
  const router = useRouter();
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

  useEffect(() => {
    async function loadRooms() {
      const user = await fetchSessionUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const roomList = await fetchRooms();

      setCurrentUser(user);
      setRooms(roomList);
      setLoading(false);
    }

    loadRooms();
  }, [router]);

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
    setRooms((prev) => [room, ...prev.filter((item) => item.id !== room.id)]);
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

    setRooms((prev) => [room, ...prev.filter((item) => item.id !== room.id)]);
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

    setRooms((prev) => [room, ...prev.filter((item) => item.id !== room.id)]);
    setSubmitting(false);
    router.push(`/chat/${room.id}`);
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

    setRooms((prev) => prev.filter((item) => item.id !== roomId));
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
    return <p className="text-sm text-zinc-500">채팅방 목록 불러오는 중...</p>;
  }

  return (
    <div className="space-y-8">
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

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">그룹 채팅방 만들기</h2>
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleCreateGroup}>
          <input
            type="text"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="채팅방 이름"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting || !groupName.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            생성
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">1:1 대화 시작</h2>
        <p className="text-sm text-zinc-500">이름 또는 이메일로 사용자를 검색해 DM을 시작하세요.</p>
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSearchUsers}>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="이름 또는 이메일"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            disabled={submitting || searching}
          />
          <button
            type="submit"
            disabled={submitting || searching || searchQuery.trim().length < 2}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {searching ? "검색 중..." : "검색"}
          </button>
        </form>

        {searchResults.length > 0 ? (
          <ul className="space-y-2">
            {searchResults.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{user.displayName}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {user.email ?? "이메일 없음"} · {getProviderLabel(user.provider)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleStartDm(user)}
                  disabled={submitting}
                  className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  대화 시작
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">나와의 대화</h2>
        <button
          type="button"
          onClick={handleCreateSelfChat}
          disabled={submitting || !currentUser}
          className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          나와의 대화 시작
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">내 채팅방</h2>

        {rooms.length === 0 ? (
          <p className="text-sm text-zinc-500">참여 중인 채팅방이 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {rooms.map((room) => (
              <li
                key={room.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/chat/${room.id}`}
                        className="truncate font-medium text-zinc-900 transition hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
                      >
                        {currentUser ? getRoomDisplayName(room, currentUser.id) : room.name}
                      </Link>
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
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => openDeleteConfirm(room)}
                      disabled={submitting}
                      className="rounded-lg border border-red-300 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        홈으로
      </Link>
    </div>
  );
}
