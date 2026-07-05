"use client";

import Link from "next/link";

import LinkPreviewCard from "@/components/LinkPreviewCard";
import MessageContent from "@/components/MessageContent";
import { type SubmitEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthUser, requireSessionUser } from "@/lib/auth";
import { extractFirstUrl } from "@/lib/link-preview";
import { Message, fetchMessages, sendMessage, type MemberReadState } from "@/lib/messages";
import { formatUnreadCount, publishRoomReadEvent, publishRoomUpdateEvent, subscribeRoomUpdateEvents } from "@/lib/room-live";
import { Room, canInviteToRoom, canRenameRoom, fetchRoom, formatRoomMemberSummary, getRoomDisplayName, inviteRoomMember, markRoomRead, updateRoomName } from "@/lib/rooms";
import { subscribeRoomMessages, subscribeRoomRead } from "@/lib/stomp";
import { SearchUser, getProviderLabel, searchUsers } from "@/lib/users";

type ChatRoomViewProps = {
  roomId: number;
};

/**
 * 중복 없이 메시지 목록에 항목을 추가한다.
 */
function appendMessage(prev: Message[], message: Message): Message[] {
  if (prev.some((item) => item.id === message.id)) {
    return prev;
  }

  return [...prev, message];
}

/**
 * 멤버 초대 API 오류 메시지를 사용자 메시지로 변환한다.
 */
function resolveInviteErrorMessage(errorMessage: string | null): string {
  if (!errorMessage) {
    return "멤버 초대에 실패했습니다.";
  }

  if (errorMessage.includes("already a member")) {
    return "이미 채팅방에 참여 중인 사용자입니다.";
  }

  if (errorMessage.includes("Cannot invite members to a DM room")) {
    return "1:1 DM 채팅방에는 멤버를 초대할 수 없습니다.";
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
 * 메시지 시간을 표시 형식으로 변환한다.
 */
function formatMessageTime(value: string): string {
  return new Date(value).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 내가 보낸 메시지별 미읽음 인원 수를 반환한다.
 */
function getOwnMessageUnreadCount(
  message: Message,
  room: Room,
  currentUserId: number,
  peerLastReadMessageId: number | null,
  memberReadStates: MemberReadState[],
): string | null {
  if (message.senderId !== currentUserId || room.type === "SELF") {
    return null;
  }

  if (room.type === "DM") {
    if (peerLastReadMessageId == null || message.id > peerLastReadMessageId) {
      return "1";
    }

    return null;
  }

  const otherMembers = room.members.filter((member) => member.userId !== currentUserId);

  if (otherMembers.length === 0) {
    return null;
  }

  const unreadCount = otherMembers.filter((member) => {
    const readState = memberReadStates.find((item) => item.userId === member.userId);
    const lastReadMessageId = readState?.lastReadMessageId ?? 0;

    return lastReadMessageId < message.id;
  }).length;

  if (unreadCount === 0) {
    return null;
  }

  return formatUnreadCount(unreadCount);
}

/**
 * 채팅방 메시지 목록 및 입력 UI.
 */
export default function ChatRoomView({ roomId }: Readonly<ChatRoomViewProps>) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const lastMarkedMessageIdRef = useRef<number | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const draftPreviewUrl = useMemo(() => extractFirstUrl(messageInput), [messageInput]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [renameErrorMessage, setRenameErrorMessage] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState("");
  const [renamingSubmitting, setRenamingSubmitting] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<SearchUser[]>([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteErrorMessage, setInviteErrorMessage] = useState<string | null>(null);
  const [peerLastReadMessageId, setPeerLastReadMessageId] = useState<number | null>(null);
  const [memberReadStates, setMemberReadStates] = useState<MemberReadState[]>([]);

  useEffect(() => {
    lastMarkedMessageIdRef.current = null;
  }, [roomId]);

  useEffect(() => {
    async function loadChatRoom() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const user = await requireSessionUser(router);

        if (!user) {
          return;
        }

        const [roomData, history] = await Promise.all([
          fetchRoom(roomId),
          fetchMessages(roomId),
        ]);

        if (!roomData || !history) {
          setErrorMessage("채팅방을 불러오지 못했습니다.");
          return;
        }

        setRoom(roomData);
        setCurrentUser(user);
        setMessages(history.messages);
        setHasMore(history.hasMore);
        setPeerLastReadMessageId(history.peerLastReadMessageId);
        setMemberReadStates(history.memberReadStates ?? []);
      } finally {
        setLoading(false);
      }
    }

    void loadChatRoom();
  }, [roomId, router]);

  useEffect(() => {
    if (loading) {
      return;
    }

    return subscribeRoomMessages(roomId, (message) => {
      setMessages((prev) => appendMessage(prev, message));
    });
  }, [roomId, loading]);

  useEffect(() => {
    if (loading || !currentUser || messages.length === 0) {
      return;
    }

    const latestMessage = messages[messages.length - 1];

    if (lastMarkedMessageIdRef.current === latestMessage.id) {
      return;
    }

    lastMarkedMessageIdRef.current = latestMessage.id;

    void markRoomRead(roomId, latestMessage.id).then((success) => {
      if (!success) {
        return;
      }

      publishRoomReadEvent({
        roomId,
        userId: currentUser.id,
        lastReadMessageId: latestMessage.id,
      });
    });
  }, [currentUser, loading, messages, roomId]);

  useEffect(() => {
    if (loading || !currentUser) {
      return;
    }

    return subscribeRoomRead(roomId, (read) => {
      if (read.userId === currentUser.id) {
        return;
      }

      setPeerLastReadMessageId(read.lastReadMessageId);
      setMemberReadStates((prev) => {
        const exists = prev.some((item) => item.userId === read.userId);

        if (exists) {
          return prev.map((item) =>
            item.userId === read.userId
              ? { ...item, lastReadMessageId: read.lastReadMessageId }
              : item,
          );
        }

        return [...prev, { userId: read.userId, lastReadMessageId: read.lastReadMessageId }];
      });
    });
  }, [currentUser, loading, roomId]);

  useEffect(() => {
    if (loading) {
      return;
    }

    return subscribeRoomUpdateEvents((updatedRoom) => {
      if (updatedRoom.id !== roomId) {
        return;
      }

      setRoom((prev) => (prev ? { ...prev, ...updatedRoom } : prev));
    });
  }, [loading, roomId]);

  function focusMessageInput() {
    messageInputRef.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages]);

  async function handleLoadMore() {
    if (loadingMore || !hasMore || messages.length === 0) {
      return;
    }

    setLoadingMore(true);
    setErrorMessage(null);

    const history = await fetchMessages(roomId, { before: messages[0].id });

    if (!history) {
      setErrorMessage("이전 메시지를 불러오지 못했습니다.");
      setLoadingMore(false);
      return;
    }

    setMessages((prev) => [...history.messages, ...prev]);
    setHasMore(history.hasMore);
    setLoadingMore(false);
  }

  function handleStartRename() {
    if (!room) {
      return;
    }

    setRenameErrorMessage(null);
    setRenameInput(room.name);
    setIsRenaming(true);
  }

  function handleCancelRename() {
    if (renamingSubmitting) {
      return;
    }

    setIsRenaming(false);
    setRenameInput("");
    setRenameErrorMessage(null);
  }

  async function handleSaveRename(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = renameInput.trim();

    if (!trimmed || !room) {
      return;
    }

    if (trimmed === room.name) {
      handleCancelRename();
      return;
    }

    setRenamingSubmitting(true);
    setRenameErrorMessage(null);

    const { room: updatedRoom, errorMessage } = await updateRoomName(roomId, trimmed);

    if (!updatedRoom) {
      setRenameErrorMessage(resolveRenameErrorMessage(errorMessage));
      setRenamingSubmitting(false);
      return;
    }

    setRoom(updatedRoom);
    publishRoomUpdateEvent(updatedRoom);
    setIsRenaming(false);
    setRenameInput("");
    setRenameErrorMessage(null);
    setRenamingSubmitting(false);
  }

  function handleCancelInvite() {
    if (inviteSubmitting) {
      return;
    }

    setIsInviting(false);
    setInviteQuery("");
    setInviteResults([]);
    setInviteErrorMessage(null);
  }

  async function handleSearchInviteUsers(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = inviteQuery.trim();

    if (trimmed.length < 2) {
      setInviteErrorMessage("검색어는 2자 이상 입력해 주세요.");
      return;
    }

    setInviteSearching(true);
    setInviteErrorMessage(null);
    setInviteResults([]);

    const results = await searchUsers(trimmed);
    const memberIds = new Set(room?.members.map((member) => member.userId) ?? []);

    const filteredResults = results.filter(
      (user) => user.id !== currentUser?.id && !memberIds.has(user.id),
    );

    setInviteResults(filteredResults);
    setInviteSearching(false);

    if (filteredResults.length === 0) {
      setInviteErrorMessage("초대 가능한 사용자가 없습니다.");
    }
  }

  async function handleInviteMember(targetUser: SearchUser) {
    if (!room) {
      return;
    }

    setInviteSubmitting(true);
    setInviteErrorMessage(null);

    const { room: updatedRoom, errorMessage } = await inviteRoomMember(roomId, targetUser.id);

    if (!updatedRoom) {
      setInviteErrorMessage(resolveInviteErrorMessage(errorMessage));
      setInviteSubmitting(false);
      return;
    }

    setRoom(updatedRoom);
    setInviteResults((prev) => prev.filter((user) => user.id !== targetUser.id));
    setInviteSubmitting(false);
  }

  function handleSendMessage(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = messageInput.trim();

    if (!trimmed) {
      return;
    }

    const contentToSend = trimmed;

    setErrorMessage(null);
    setMessageInput("");
    focusMessageInput();

    void sendMessage(roomId, contentToSend).then((message) => {
      if (!message) {
        setErrorMessage("메시지 전송에 실패했습니다.");
        focusMessageInput();
        return;
      }

      setMessages((prev) => appendMessage(prev, message));
      focusMessageInput();
    });
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">채팅방 불러오는 중...</p>;
  }

  if (!currentUser) {
    return <p className="text-sm text-zinc-500">로그인 페이지로 이동 중...</p>;
  }

  if (!room) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600 dark:text-red-400">
          {errorMessage ?? "채팅방을 찾을 수 없습니다."}
        </p>
        <Link
          href="/chat"
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          채팅방 목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-700">
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <form className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={handleSaveRename}>
              <input
                type="text"
                value={renameInput}
                onChange={(event) => {
                  setRenameInput(event.target.value);
                  setRenameErrorMessage(null);
                }}
                placeholder="채팅방 이름"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                disabled={renamingSubmitting}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={renamingSubmitting || !renameInput.trim()}
                  className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {renamingSubmitting ? "저장 중..." : "저장"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelRename}
                  disabled={renamingSubmitting}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  취소
                </button>
              </div>
              {renameErrorMessage ? (
                <p className="text-sm text-red-600 dark:text-red-400">{renameErrorMessage}</p>
              ) : null}
            </form>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <h2 className="truncate text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {getRoomDisplayName(room, currentUser.id)}
              </h2>
              {canRenameRoom(room.type) ? (
                <button
                  type="button"
                  onClick={handleStartRename}
                  className="shrink-0 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  이름 변경
                </button>
              ) : null}
              {canInviteToRoom(room.type) ? (
                <button
                  type="button"
                  onClick={() => {
                    if (isInviting) {
                      handleCancelInvite();
                      return;
                    }

                    setIsInviting(true);
                    setInviteErrorMessage(null);
                  }}
                  className="shrink-0 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {isInviting ? "초대 닫기" : "멤버 초대"}
                </button>
              ) : null}
            </div>
          )}

          <p className="mt-1 text-xs text-zinc-500">{formatRoomMemberSummary(room)}</p>
        </div>
      </div>

      {isInviting && canInviteToRoom(room.type) ? (
        <section className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">멤버 초대</h3>
          <p className="mt-1 text-xs text-zinc-500">이름 또는 이메일로 사용자를 검색해 초대하세요.</p>
          <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={handleSearchInviteUsers}>
            <input
              type="text"
              value={inviteQuery}
              onChange={(event) => {
                setInviteQuery(event.target.value);
                setInviteErrorMessage(null);
              }}
              placeholder="이름 또는 이메일"
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              disabled={inviteSearching || inviteSubmitting}
            />
            <button
              type="submit"
              disabled={inviteSearching || inviteSubmitting || inviteQuery.trim().length < 2}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {inviteSearching ? "검색 중..." : "검색"}
            </button>
          </form>

          {inviteErrorMessage ? (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{inviteErrorMessage}</p>
          ) : null}

          {inviteResults.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {inviteResults.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{user.displayName}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {user.email ?? "이메일 없음"} · {getProviderLabel(user.provider)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInviteMember(user)}
                    disabled={inviteSubmitting}
                    className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    초대
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {errorMessage ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {hasMore ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {loadingMore ? "불러오는 중..." : "이전 메시지 불러오기"}
              </button>
            </div>
          ) : null}

          {messages.length === 0 ? (
            <p className="text-center text-sm text-zinc-500">아직 메시지가 없습니다. 첫 메시지를 보내 보세요.</p>
          ) : (
            messages.map((message) => {
              const isMine = message.senderId === currentUser.id;
              const unreadCountLabel = getOwnMessageUnreadCount(
                message,
                room,
                currentUser.id,
                peerLastReadMessageId,
                memberReadStates,
              );

              return (
                <div key={message.id} className={`flex items-end gap-1.5 ${isMine ? "justify-end" : "justify-start"}`}>
                  {isMine && unreadCountLabel ? (
                    <span className="pb-1 text-xs font-semibold text-sky-400 dark:text-sky-500">
                      {unreadCountLabel}
                    </span>
                  ) : null}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                      isMine
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    {!isMine ? (
                      <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {message.senderDisplayName}
                      </p>
                    ) : null}
                    <MessageContent content={message.content} isMine={isMine} />
                    <p
                      className={`mt-1 text-[11px] ${
                        isMine ? "text-zinc-300 dark:text-zinc-500" : "text-zinc-400"
                      }`}
                    >
                      {formatMessageTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {draftPreviewUrl ? (
          <div className="shrink-0 border-t border-zinc-200 px-3 pt-3 dark:border-zinc-700">
            <LinkPreviewCard url={draftPreviewUrl} debounceMs={400} />
          </div>
        ) : null}

        <form
          className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-700"
          onSubmit={handleSendMessage}
        >
          <input
            ref={messageInputRef}
            type="text"
            value={messageInput}
            onChange={(event) => setMessageInput(event.target.value)}
            placeholder="메시지를 입력하세요"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            autoFocus
          />
          <button
            type="submit"
            disabled={!messageInput.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            전송
          </button>
        </form>
      </div>
    </div>
  );
}
