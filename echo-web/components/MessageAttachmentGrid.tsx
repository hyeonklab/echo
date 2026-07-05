"use client";

import { type DragEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import AuthenticatedImage from "@/components/AuthenticatedImage";
import { downloadFile, downloadFiles } from "@/lib/files";
import type { MessageFile } from "@/lib/messages";

type MessageAttachmentGridProps = {
  attachments: MessageFile[];
  isMine: boolean;
};

/**
 * 미리보기 영역에서 첨부 드래그 이벤트 전파를 막는다.
 */
function blockAttachmentDrag(event: DragEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * 메시지 이미지 앨범을 렌더링한다.
 */
export default function MessageAttachmentGrid({
  attachments,
  isMine,
}: Readonly<MessageAttachmentGridProps>) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const activeAttachment = activeIndex === null ? null : attachments[activeIndex] ?? null;
  const hasMultipleAttachments = attachments.length > 1;
  const canGoPrevious = activeIndex !== null && activeIndex > 0;
  const canGoNext = activeIndex !== null && activeIndex < attachments.length - 1;
  const gridClassName =
    attachments.length === 1
      ? "grid-cols-1"
      : attachments.length === 2
        ? "grid-cols-2"
        : "grid-cols-2";

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDownloadError(null);
        setActiveIndex(null);
        return;
      }

      if (event.key === "ArrowLeft") {
        setDownloadError(null);
        setActiveIndex((previousIndex) => {
          if (previousIndex === null || previousIndex <= 0) {
            return previousIndex;
          }

          return previousIndex - 1;
        });
      }

      if (event.key === "ArrowRight") {
        setDownloadError(null);
        setActiveIndex((previousIndex) => {
          if (previousIndex === null || previousIndex >= attachments.length - 1) {
            return previousIndex;
          }

          return previousIndex + 1;
        });
      }
    }

    globalThis.addEventListener("keydown", handleKeyDown);

    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeIndex, attachments.length]);

  function handleOpenAttachment(fileId: number) {
    const index = attachments.findIndex((attachment) => attachment.id === fileId);

    if (index < 0) {
      return;
    }

    setDownloadError(null);
    setActiveIndex(index);
  }

  function handleCloseViewer() {
    setDownloadError(null);
    setActiveIndex(null);
  }

  function handleShowPrevious() {
    if (!canGoPrevious) {
      return;
    }

    setDownloadError(null);
    setActiveIndex((previousIndex) => (previousIndex === null ? null : previousIndex - 1));
  }

  function handleShowNext() {
    if (!canGoNext) {
      return;
    }

    setDownloadError(null);
    setActiveIndex((previousIndex) => (previousIndex === null ? null : previousIndex + 1));
  }

  async function handleDownloadCurrent() {
    if (!activeAttachment) {
      return;
    }

    setDownloadError(null);

    const success = await downloadFile(activeAttachment.id, activeAttachment.originalName);

    if (!success) {
      setDownloadError("파일 다운로드에 실패했습니다.");
    }
  }

  async function handleDownloadAll() {
    if (attachments.length === 0 || downloadingAll) {
      return;
    }

    setDownloadError(null);
    setDownloadingAll(true);

    const result = await downloadFiles(
      attachments.map((attachment) => ({
        id: attachment.id,
        originalName: attachment.originalName,
      })),
    );

    setDownloadingAll(false);

    if (result.failedCount > 0) {
      setDownloadError(
        result.successCount > 0
          ? `${result.successCount}장 다운로드 완료, ${result.failedCount}장 실패했습니다.`
          : "파일 다운로드에 실패했습니다.",
      );
    }
  }

  async function handleDownloadSingle() {
    if (attachments.length !== 1 || downloadingAll) {
      return;
    }

    setDownloadError(null);
    setDownloadingAll(true);

    const success = await downloadFile(attachments[0].id, attachments[0].originalName);

    setDownloadingAll(false);

    if (!success) {
      setDownloadError("파일 다운로드에 실패했습니다.");
    }
  }

  const downloadButtonClassName = isMine
    ? "text-sky-200 hover:text-sky-100 dark:text-sky-700 dark:hover:text-sky-800"
    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200";

  return (
    <>
      <div className={`mt-2 grid gap-1 ${gridClassName}`}>
        {attachments.map((attachment) => (
          <button
            key={attachment.id}
            type="button"
            onClick={() => handleOpenAttachment(attachment.id)}
            className="min-h-20 overflow-hidden rounded-lg"
          >
            <AuthenticatedImage
              fileId={attachment.id}
              alt={attachment.originalName}
              className="max-h-56 w-full object-cover"
            />
          </button>
        ))}
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
        {hasMultipleAttachments ? (
          <button
            type="button"
            disabled={downloadingAll}
            onClick={() => void handleDownloadAll()}
            className={`cursor-pointer text-xs underline underline-offset-2 disabled:cursor-default disabled:opacity-60 ${downloadButtonClassName}`}
          >
            {downloadingAll ? "다운로드 중..." : `전체 다운로드 (${attachments.length})`}
          </button>
        ) : (
          <button
            type="button"
            disabled={downloadingAll}
            onClick={() => void handleDownloadSingle()}
            className={`cursor-pointer text-xs underline underline-offset-2 disabled:cursor-default disabled:opacity-60 ${downloadButtonClassName}`}
          >
            {downloadingAll ? "다운로드 중..." : "다운로드"}
          </button>
        )}
      </div>

      {downloadError && activeIndex === null ? (
        <p className="mt-1 text-right text-xs text-red-500 dark:text-red-400">{downloadError}</p>
      ) : null}

      {activeAttachment && activeIndex !== null && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
              onClick={handleCloseViewer}
              onDragEnter={blockAttachmentDrag}
              onDragLeave={blockAttachmentDrag}
              onDragOver={blockAttachmentDrag}
              onDrop={blockAttachmentDrag}
              role="dialog"
              aria-modal="true"
              aria-label="이미지 보기"
            >
              {hasMultipleAttachments ? (
                <>
                  <button
                    type="button"
                    aria-label="이전 사진"
                    disabled={!canGoPrevious}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleShowPrevious();
                    }}
                    className="absolute left-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-2xl text-white transition hover:bg-black/70 disabled:cursor-default disabled:opacity-30"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="다음 사진"
                    disabled={!canGoNext}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleShowNext();
                    }}
                    className="absolute right-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-2xl text-white transition hover:bg-black/70 disabled:cursor-default disabled:opacity-30"
                  >
                    ›
                  </button>
                </>
              ) : null}

              <div
                className={`relative z-10 max-h-[90vh] max-w-3xl rounded-xl p-3 ${
                  isMine ? "bg-zinc-900" : "bg-white dark:bg-zinc-900"
                }`}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="relative">
                  {hasMultipleAttachments ? (
                    <>
                      <button
                        type="button"
                        aria-label="이전 사진"
                        disabled={!canGoPrevious}
                        onClick={handleShowPrevious}
                        className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-pointer disabled:cursor-default"
                      />
                      <button
                        type="button"
                        aria-label="다음 사진"
                        disabled={!canGoNext}
                        onClick={handleShowNext}
                        className="absolute inset-y-0 right-0 z-10 w-1/3 cursor-pointer disabled:cursor-default"
                      />
                    </>
                  ) : null}

                  <AuthenticatedImage
                    fileId={activeAttachment.id}
                    alt={activeAttachment.originalName}
                    className="max-h-[75vh] w-full rounded-lg object-contain"
                    draggable={false}
                  />
                </div>

                {hasMultipleAttachments ? (
                  <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    {activeIndex + 1} / {attachments.length}
                  </p>
                ) : null}

                {downloadError && activeIndex !== null ? (
                  <p className="mt-2 text-sm text-red-500 dark:text-red-400">{downloadError}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCloseViewer}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
                  >
                    닫기
                  </button>
                  {hasMultipleAttachments ? (
                    <button
                      type="button"
                      disabled={downloadingAll}
                      onClick={() => void handleDownloadAll()}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-200"
                    >
                      {downloadingAll ? "다운로드 중..." : `전체 다운로드 (${attachments.length})`}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleDownloadCurrent()}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    다운로드
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
