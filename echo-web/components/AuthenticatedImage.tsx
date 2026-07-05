"use client";

import { useEffect, useState } from "react";

import { fetchAuthenticatedFileBlob } from "@/lib/files";

type AuthenticatedImageProps = {
  fileId: number;
  alt: string;
  className?: string;
  draggable?: boolean;
};

type ImageStatus = "loading" | "ready" | "error";

/**
 * 인증이 필요한 이미지 파일을 표시한다.
 */
export default function AuthenticatedImage({
  fileId,
  alt,
  className = "",
  draggable,
}: Readonly<AuthenticatedImageProps>) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ImageStatus>("loading");

  useEffect(() => {
    let active = true;

    setStatus("loading");
    setObjectUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }

      return null;
    });

    void fetchAuthenticatedFileBlob(fileId).then((blob) => {
      if (!active) {
        return;
      }

      if (!blob) {
        setStatus("error");
        return;
      }

      setObjectUrl(URL.createObjectURL(blob));
      setStatus("ready");
    });

    return () => {
      active = false;
    };
  }, [fileId]);

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  if (status === "error") {
    return (
      <div
        className={`${className} flex min-h-20 min-w-20 items-center justify-center rounded-lg bg-zinc-200 text-xs text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300`}
        role="img"
        aria-label={`${alt} 로드 실패`}
      >
        이미지를 불러올 수 없습니다
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <div
        className={`${className} min-h-20 min-w-20 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700`}
        aria-hidden="true"
      />
    );
  }

  return <img src={objectUrl} alt={alt} className={className} draggable={draggable} />;
}
