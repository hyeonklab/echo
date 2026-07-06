"use client";

import Link from "next/link";

import LinkPreviewCard from "@/components/LinkPreviewCard";
import MessageContent from "@/components/MessageContent";
import RoomAvatar from "@/components/RoomAvatar";
import UserAvatar from "@/components/UserAvatar";
import { type ChangeEvent, type DragEvent, type MouseEvent, type SubmitEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthUser, requireSessionUser } from "@/lib/auth";
import { extractFirstUrl } from "@/lib/link-preview";
import { uploadFiles } from "@/lib/files";
import {
  Message,
  type MessageDeleteScope,
  deleteMessage,
  fetchMessages,
  sendMessage,
  type MemberReadState,
} from "@/lib/messages";
import { formatUnreadCount, publishRoomMessageDeletedEvent, publishRoomReadEvent, publishRoomUpdateEvent, publishRoomLeftEvent, subscribeRoomUpdateEvents } from "@/lib/room-live";
import { Room, canInviteToRoom, canRenameRoom, deleteRoom, fetchRoom, formatRoomMemberSummary, getLeaveRoomConfirmText, getLeaveRoomLabel, getRoomDisplayName, getRoomMember, inviteRoomMember, markRoomRead, updateRoomName } from "@/lib/rooms";
import { subscribeRoomMessageDeletes, subscribeRoomMessages, subscribeRoomRead } from "@/lib/stomp";
import { SearchUser, getProviderLabel, searchUsers } from "@/lib/users";

type ChatRoomViewProps = {
  roomId: number;
};

type MessageContextMenuState = {
  x: number;
  y: number;
  message: Message;
};

type PendingAttachment = {
  key: string;
  file: File;
  previewUrl: string;
};

const MAX_ATTACHMENT_COUNT = 30;

/**
 * 삭제 확인용 메시지 미리보기를 반환한다.
 */
function formatDeletePreview(message: Message, maxLength = 60): string {
  const normalized = message.content.replace(/\s+/g, " ").trim();

  if (normalized.length > 0) {
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength)}...`;
  }

  const attachmentCount = message.attachments?.length ?? 0;

  if (attachmentCount > 0) {
    return `사진 ${attachmentCount}장`;
  }

  return "메시지";
}

/**
 * 첨부 가능한 이미지 파일인지 확인한다.
 */
function isAttachableImage(file: File): boolean {
  if (file.type.startsWith("image/")) {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  return extension === "jpg"
    || extension === "jpeg"
    || extension === "png"
    || extension === "gif"
    || extension === "webp";
}

/**
 * 드래그 중인 항목에 파일이 포함되어 있는지 확인한다.
 */
function hasImageDragPayload(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes("Files")
    || Array.from(dataTransfer.items).some((item) => item.kind === "file");
}

/**
 * 드롭된 파일 목록을 반환한다.
 */
function extractDroppedImageFiles(dataTransfer: DataTransfer): File[] {
  if (dataTransfer.files.length > 0) {
    return Array.from(dataTransfer.files);
  }

  return Array.from(dataTransfer.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}

/**
 * 메시지 목록에서 항목을 제거한다.
 */
function removeMessage(prev: Message[], messageId: number): Message[] {
  return prev.filter((item) => item.id !== messageId);
}

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
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const pendingAttachmentKeyRef = useRef(0);
  const attachmentDragDepthRef = useRef(0);
  const lastMarkedMessageIdRef = useRef<number | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [isAttachmentDragOver, setIsAttachmentDragOver] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
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
  const [messageMenu, setMessageMenu] = useState<MessageContextMenuState | null>(null);
  const [pendingDeleteMessage, setPendingDeleteMessage] = useState<{
    message: Message;
    scope: MessageDeleteScope;
  } | null>(null);
  const [pendingLeaveRoom, setPendingLeaveRoom] = useState(false);
  const [leavingRoom, setLeavingRoom] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<number | null>(null);

  useEffect(() => {
    lastMarkedMessageIdRef.current = null;
    setPendingAttachments((prev) => {
      for (const attachment of prev) {
        URL.revokeObjectURL(attachment.previewUrl);
      }

      return [];
    });
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
    if (loading) {
      return;
    }

    return subscribeRoomMessageDeletes(roomId, (deleted) => {
      setMessages((prev) => removeMessage(prev, deleted.messageId));
      setPendingDeleteMessage((pending) =>
        pending?.message.id === deleted.messageId ? null : pending,
      );
      setDeletingMessageId((current) => (current === deleted.messageId ? null : current));
      setErrorMessage((current) =>
        current === "메시지 삭제에 실패했습니다." ? null : current,
      );
      publishRoomMessageDeletedEvent(deleted);
    });
  }, [roomId, loading]);

  useEffect(() => {
    if (!messageMenu) {
      return;
    }

    function closeMenu() {
      setMessageMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    globalThis.window.addEventListener("click", closeMenu);
    globalThis.window.addEventListener("scroll", closeMenu, true);
    globalThis.window.addEventListener("keydown", handleKeyDown);

    return () => {
      globalThis.window.removeEventListener("click", closeMenu);
      globalThis.window.removeEventListener("scroll", closeMenu, true);
      globalThis.window.removeEventListener("keydown", handleKeyDown);
    };
  }, [messageMenu]);

  useEffect(() => {
    if (!pendingDeleteMessage) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && deletingMessageId === null) {
        setPendingDeleteMessage(null);
      }
    }

    globalThis.window.addEventListener("keydown", handleKeyDown);

    return () => {
      globalThis.window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pendingDeleteMessage, deletingMessageId]);

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

  function handleOpenMessageMenu(event: MouseEvent<HTMLDivElement>, message: Message) {
    event.preventDefault();

    setMessageMenu({
      x: event.clientX,
      y: event.clientY,
      message,
    });
  }

  function handleRequestDeleteMessage(scope: MessageDeleteScope) {
    if (!messageMenu) {
      return;
    }

    setPendingDeleteMessage({
      message: messageMenu.message,
      scope,
    });
    setMessageMenu(null);
  }

  function handleCancelDeleteMessage() {
    if (deletingMessageId !== null) {
      return;
    }

    setPendingDeleteMessage(null);
  }

  function handleRequestLeaveRoom() {
    setPendingLeaveRoom(true);
    setErrorMessage(null);
  }

  function handleCancelLeaveRoom() {
    if (leavingRoom) {
      return;
    }

    setPendingLeaveRoom(false);
  }

  async function handleConfirmLeaveRoom() {
    if (!room) {
      return;
    }

    setLeavingRoom(true);
    setErrorMessage(null);
    setPendingLeaveRoom(false);

    const success = await deleteRoom(roomId);

    setLeavingRoom(false);

    if (!success) {
      setErrorMessage("채팅방 나가기에 실패했습니다.");
      return;
    }

    publishRoomLeftEvent(roomId);
    router.push("/chat");
  }

  async function handleConfirmDeleteMessage() {
    if (!pendingDeleteMessage) {
      return;
    }

    const { message: targetMessage, scope } = pendingDeleteMessage;
    const targetId = targetMessage.id;

    setPendingDeleteMessage(null);
    setDeletingMessageId(targetId);
    setErrorMessage(null);

    const success = await deleteMessage(roomId, targetId, scope);

    setDeletingMessageId(null);

    let messageStillVisible = false;

    setMessages((prev) => {
      messageStillVisible = prev.some((item) => item.id === targetId);

      if (success || !messageStillVisible) {
        return removeMessage(prev, targetId);
      }

      return prev;
    });

    if (!success && messageStillVisible) {
      setErrorMessage("메시지 삭제에 실패했습니다.");
    }
  }

  function addPendingAttachmentFiles(selectedFiles: File[]) {
    if (selectedFiles.length === 0 || sendingMessage) {
      return;
    }

    const remainingSlots = MAX_ATTACHMENT_COUNT - pendingAttachments.length;

    if (remainingSlots <= 0) {
      setErrorMessage(`이미지는 최대 ${MAX_ATTACHMENT_COUNT}장까지 첨부할 수 있습니다.`);
      return;
    }

    const files = selectedFiles.slice(0, remainingSlots);
    const invalidFiles = files.filter((file) => !isAttachableImage(file));

    if (invalidFiles.length > 0) {
      setErrorMessage("JPG, PNG, GIF, WEBP 이미지만 첨부할 수 있습니다.");
      return;
    }

    const nextAttachments = files.map((file) => ({
      key: `attachment-${(pendingAttachmentKeyRef.current += 1)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPendingAttachments((prev) => [...prev, ...nextAttachments]);
    setErrorMessage(null);
  }

  function handleAttachmentSelect(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selectedFiles = input.files;

    if (!selectedFiles || selectedFiles.length === 0) {
      return;
    }

    addPendingAttachmentFiles(Array.from(selectedFiles));
    input.value = "";
  }

  function handleAttachmentDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!hasImageDragPayload(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    attachmentDragDepthRef.current += 1;
    setIsAttachmentDragOver(true);
  }

  function handleAttachmentDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    attachmentDragDepthRef.current -= 1;

    if (attachmentDragDepthRef.current <= 0) {
      attachmentDragDepthRef.current = 0;
      setIsAttachmentDragOver(false);
    }
  }

  function handleAttachmentDragOver(event: DragEvent<HTMLDivElement>) {
    if (!hasImageDragPayload(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleAttachmentDrop(event: DragEvent<HTMLDivElement>) {
    if (!hasImageDragPayload(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    attachmentDragDepthRef.current = 0;
    setIsAttachmentDragOver(false);

    addPendingAttachmentFiles(extractDroppedImageFiles(event.dataTransfer));
  }

  function handleOpenAttachmentPicker() {
    if (sendingMessage || pendingAttachments.length >= MAX_ATTACHMENT_COUNT) {
      return;
    }

    attachmentInputRef.current?.click();
  }

  function handleRemoveAttachment(key: string) {
    setPendingAttachments((prev) => {
      const target = prev.find((attachment) => attachment.key === key);

      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }

      return prev.filter((attachment) => attachment.key !== key);
    });
  }

  function handleSendMessage(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = messageInput.trim();

    if (!trimmed && pendingAttachments.length === 0) {
      return;
    }

    const contentToSend = trimmed;
    const attachmentsToSend = [...pendingAttachments];

    setErrorMessage(null);
    setMessageInput("");
    setPendingAttachments([]);
    setSendingMessage(true);
    focusMessageInput();

    void (async () => {
      try {
        let attachmentIds: number[] = [];

        if (attachmentsToSend.length > 0) {
          const uploadResult = await uploadFiles(
            "MESSAGE",
            attachmentsToSend.map((attachment) => attachment.file),
          );

          if ("errorMessage" in uploadResult) {
            setPendingAttachments(attachmentsToSend);
            setMessageInput(contentToSend);
            setErrorMessage(uploadResult.errorMessage);
            return;
          }

          attachmentIds = uploadResult.files.map((file) => file.id);
        }

        const message = await sendMessage(roomId, contentToSend, attachmentIds);

        for (const attachment of attachmentsToSend) {
          URL.revokeObjectURL(attachment.previewUrl);
        }

        if (!message) {
          setPendingAttachments(attachmentsToSend);
          setMessageInput(contentToSend);
          setErrorMessage("메시지 전송에 실패했습니다.");
          return;
        }

        setMessages((prev) => appendMessage(prev, message));
      } catch {
        setPendingAttachments(attachmentsToSend);
        setMessageInput(contentToSend);
        setErrorMessage("메시지 전송 중 오류가 발생했습니다.");
      } finally {
        setSendingMessage(false);
        focusMessageInput();
      }
    })();
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

  const leaveRoomLabel = getLeaveRoomLabel(room, currentUser.id);
  const leaveRoomConfirm = getLeaveRoomConfirmText(
    room,
    currentUser.id,
    getRoomDisplayName(room, currentUser.id),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-start gap-2 border-b border-zinc-200 px-3 py-3 md:gap-3 md:px-4 md:pb-4 dark:border-zinc-700">
        <Link
          href="/chat"
          aria-label="채팅 목록으로"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-300 text-lg leading-none text-zinc-700 md:hidden dark:border-zinc-600 dark:text-zinc-200"
        >
          ‹
        </Link>
        <RoomAvatar
          room={room}
          currentUserId={currentUser.id}
          className="h-11 w-11 shrink-0"
          textClassName="text-sm font-semibold"
        />
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
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-zinc-900 md:text-xl dark:text-zinc-50">
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
              <button
                type="button"
                onClick={handleRequestLeaveRoom}
                disabled={leavingRoom}
                className="shrink-0 rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                {leaveRoomLabel}
              </button>
            </div>
          )}

          <p className="mt-1 text-xs text-zinc-500">{formatRoomMemberSummary(room)}</p>
        </div>
      </div>

      {isInviting && canInviteToRoom(room.type) ? (
        <section className="mx-3 mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 md:mx-4 dark:border-zinc-700 dark:bg-zinc-800/50">
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
        <p className="mx-3 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 md:mx-4 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <div
        className="relative mx-3 mt-3 flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-zinc-50 md:mx-4 md:mt-4 dark:border-zinc-700 dark:bg-zinc-800/50"
        onDragEnter={handleAttachmentDragEnter}
        onDragLeave={handleAttachmentDragLeave}
        onDragOver={handleAttachmentDragOver}
        onDrop={handleAttachmentDrop}
      >
        {isAttachmentDragOver ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-sky-400 bg-sky-500/10">
            <p className="rounded-lg bg-white/90 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm dark:bg-zinc-900/90 dark:text-sky-300">
              사진을 놓으면 첨부됩니다
            </p>
          </div>
        ) : null}
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
            messages.map((message, index) => {
              const isMine = message.senderId === currentUser.id;
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const showSenderAvatar =
                !isMine
                && (prevMessage == null || prevMessage.senderId !== message.senderId);
              const senderMember = getRoomMember(room, message.senderId);
              const unreadCountLabel = getOwnMessageUnreadCount(
                message,
                room,
                currentUser.id,
                peerLastReadMessageId,
                memberReadStates,
              );

              return (
                <div key={message.id} className={`flex items-end gap-1.5 ${isMine ? "justify-end" : "justify-start"}`}>
                  {!isMine ? (
                    showSenderAvatar ? (
                      <UserAvatar
                        displayName={senderMember?.displayName ?? message.senderDisplayName}
                        avatarFileId={senderMember?.avatarFileId}
                        className="mb-0.5 h-8 w-8 shrink-0"
                        textClassName="text-[11px] font-semibold"
                      />
                    ) : (
                      <div className="mb-0.5 h-8 w-8 shrink-0" aria-hidden />
                    )
                  ) : null}
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
                    } ${deletingMessageId === message.id ? "opacity-50" : ""}`}
                    onContextMenu={(event) => handleOpenMessageMenu(event, message)}
                  >
                    {!isMine && showSenderAvatar && room.type === "GROUP" ? (
                      <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {message.senderDisplayName}
                      </p>
                    ) : null}
                    <MessageContent
                      content={message.content}
                      attachments={message.attachments ?? []}
                      isMine={isMine}
                    />
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

        {pendingAttachments.length > 0 ? (
          <div className="shrink-0 border-t border-zinc-200 px-3 pt-3 dark:border-zinc-700">
            <p className="mb-2 text-xs text-zinc-500">
              첨부 {pendingAttachments.length}장 · 전송 버튼을 눌러 보내세요
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {pendingAttachments.map((attachment) => (
                <div key={attachment.key} className="relative shrink-0">
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.file.name}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    aria-label="첨부 이미지 제거"
                    onClick={() => handleRemoveAttachment(attachment.key)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <form
          className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-700"
          onSubmit={handleSendMessage}
        >
          <input
            ref={attachmentInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
            multiple
            tabIndex={-1}
            className="hidden"
            onChange={handleAttachmentSelect}
          />
          <button
            type="button"
            onClick={handleOpenAttachmentPicker}
            disabled={sendingMessage || pendingAttachments.length >= MAX_ATTACHMENT_COUNT}
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            사진
          </button>
          <input
            ref={messageInputRef}
            type="text"
            value={messageInput}
            onChange={(event) => setMessageInput(event.target.value)}
            placeholder="메시지를 입력하세요"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            autoFocus
            disabled={sendingMessage}
          />
          <button
            type="submit"
            disabled={sendingMessage || (!messageInput.trim() && pendingAttachments.length === 0)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {sendingMessage ? "전송 중..." : "전송"}
          </button>
        </form>
      </div>

      {messageMenu ? (
        <div
          className="fixed z-50 min-w-[168px] overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
          style={{ left: messageMenu.x, top: messageMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            disabled={deletingMessageId === messageMenu.message.id}
            onClick={() => handleRequestDeleteMessage("me")}
            className="block w-full px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            나에게만 삭제
          </button>
          {messageMenu.message.senderId === currentUser.id ? (
            <button
              type="button"
              disabled={deletingMessageId === messageMenu.message.id}
              onClick={() => handleRequestDeleteMessage("all")}
              className="block w-full px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              모두에게서 삭제
            </button>
          ) : null}
        </div>
      ) : null}

      {pendingDeleteMessage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="삭제 확인 닫기"
            className="absolute inset-0 bg-black/50"
            onClick={handleCancelDeleteMessage}
            disabled={deletingMessageId !== null}
          />
          <div
            role="alertdialog"
            aria-labelledby="delete-message-title"
            aria-describedby="delete-message-description"
            className="relative w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            <h3 id="delete-message-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {pendingDeleteMessage.scope === "all" ? "모두에게서 삭제" : "나에게만 삭제"}
            </h3>
            <p id="delete-message-description" className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {formatDeletePreview(pendingDeleteMessage.message)}
              </span>
              {" "}
              {pendingDeleteMessage.scope === "all"
                ? "메시지를 모든 참여자에게서 삭제할까요?"
                : "메시지를 나에게만 삭제할까요?"}
            </p>
            {pendingDeleteMessage.scope === "all" ? (
              <p className="mt-1 text-xs text-zinc-500">삭제 후에는 모든 참여자 화면에서 사라집니다.</p>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">다른 참여자에게는 계속 보입니다.</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelDeleteMessage}
                disabled={deletingMessageId !== null}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeleteMessage()}
                disabled={deletingMessageId !== null}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deletingMessageId !== null ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingLeaveRoom ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="나가기 확인 닫기"
            className="absolute inset-0 bg-black/50"
            onClick={handleCancelLeaveRoom}
            disabled={leavingRoom}
          />
          <div
            role="alertdialog"
            aria-labelledby="leave-room-title"
            aria-describedby="leave-room-description"
            className="relative w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            <h3 id="leave-room-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {leaveRoomConfirm.title}
            </h3>
            <p id="leave-room-description" className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {leaveRoomConfirm.description}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{leaveRoomConfirm.hint}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelLeaveRoom}
                disabled={leavingRoom}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmLeaveRoom()}
                disabled={leavingRoom}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {leavingRoom ? "처리 중..." : leaveRoomConfirm.title}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
