"use client";

import Link from "next/link";
import { type SubmitEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthUser, clearTokens, fetchCurrentUser, getAccessToken } from "@/lib/auth";
import {
  Room,
  createDmRoom,
  createGroupRoom,
  deleteRoom,
  fetchRooms,
  inviteRoomMember,
} from "@/lib/rooms";

/**
 * DM 생성 API 오류 메시지를 사용자 메시지로 변환한다.
 */
function resolveDmErrorMessage(errorMessage: string | null): string {
  if (!errorMessage) {
    return "DM 채팅방 생성에 실패했습니다.";
  }

  if (errorMessage.includes("yourself")) {
    return "자신과는 DM을 시작할 수 없습니다.";
  }

  if (errorMessage.includes("User not found")) {
    return "존재하지 않는 사용자 ID입니다.";
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
  const [dmUserId, setDmUserId] = useState("");
  const [inviteRoomId, setInviteRoomId] = useState("");
  const [inviteUserId, setInviteUserId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeleteRoom, setPendingDeleteRoom] = useState<Room | null>(null);

  useEffect(() => {
    async function loadRooms() {
      const token = getAccessToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      const [roomList, user] = await Promise.all([fetchRooms(token), fetchCurrentUser(token)]);

      if (!user) {
        clearTokens();
        router.replace("/login");
        return;
      }

      setCurrentUser(user);
      setRooms(roomList);
      setLoading(false);
    }

    loadRooms();
  }, [router]);

  async function handleCreateGroup(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getAccessToken();

    if (!token || !groupName.trim()) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const room = await createGroupRoom(token, groupName.trim());

    if (!room) {
      setErrorMessage("그룹 채팅방 생성에 실패했습니다.");
      setSubmitting(false);
      return;
    }

    setGroupName("");
    setRooms((prev) => [room, ...prev.filter((item) => item.id !== room.id)]);
    setSubmitting(false);
  }

  async function handleCreateDm(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getAccessToken();
    const targetUserId = Number(dmUserId);

    if (!token || !Number.isInteger(targetUserId) || targetUserId <= 0) {
      setErrorMessage("유효한 상대 사용자 ID를 입력하세요.");
      return;
    }

    if (currentUser?.id === targetUserId) {
      setErrorMessage("자신과는 DM을 시작할 수 없습니다.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const { room, errorMessage } = await createDmRoom(token, targetUserId);

    if (!room) {
      setErrorMessage(resolveDmErrorMessage(errorMessage));
      setSubmitting(false);
      return;
    }

    setDmUserId("");
    setRooms((prev) => [room, ...prev.filter((item) => item.id !== room.id)]);
    setSubmitting(false);
  }

  async function handleInviteMember(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getAccessToken();
    const roomId = Number(inviteRoomId);
    const userId = Number(inviteUserId);

    if (!token || !Number.isInteger(roomId) || !Number.isInteger(userId)) {
      setErrorMessage("채팅방 ID와 사용자 ID를 확인하세요.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const room = await inviteRoomMember(token, roomId, userId);

    if (!room) {
      setErrorMessage("멤버 초대에 실패했습니다.");
      setSubmitting(false);
      return;
    }

    setInviteRoomId("");
    setInviteUserId("");
    setRooms((prev) => prev.map((item) => (item.id === room.id ? room : item)));
    setSubmitting(false);
  }

  async function confirmDeleteRoom() {
    const token = getAccessToken();
    const roomId = pendingDeleteRoom?.id;

    if (!token || roomId == null) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setPendingDeleteRoom(null);

    const deleted = await deleteRoom(token, roomId);

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
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{pendingDeleteRoom.name}</span>
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
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">1:1 DM 시작</h2>
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleCreateDm}>
          <input
            type="number"
            min={1}
            value={dmUserId}
            onChange={(event) => setDmUserId(event.target.value)}
            placeholder="상대 사용자 ID"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            DM 시작
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">멤버 초대 (그룹)</h2>
        <form className="grid gap-3 sm:grid-cols-3" onSubmit={handleInviteMember}>
          <input
            type="number"
            min={1}
            value={inviteRoomId}
            onChange={(event) => setInviteRoomId(event.target.value)}
            placeholder="채팅방 ID"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            disabled={submitting}
          />
          <input
            type="number"
            min={1}
            value={inviteUserId}
            onChange={(event) => setInviteUserId(event.target.value)}
            placeholder="초대할 사용자 ID"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
          >
            초대
          </button>
        </form>
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
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{room.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {room.type === "DM" ? "1:1 DM" : "그룹"} · ID {room.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500">{room.members.length}명</span>
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
                <p className="mt-3 text-xs text-zinc-500">
                  {room.members.map((member) => member.displayName).join(", ")}
                </p>
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
