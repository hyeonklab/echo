import { ensureAccessToken, normalizeAuthUser, type AuthUser } from "@/lib/auth";
import { apiFetch, FILE_UPLOAD_TIMEOUT_MS, getApiUrl } from "@/lib/api";

const FILE_FETCH_TIMEOUT_MS = FILE_UPLOAD_TIMEOUT_MS;

export type FilePurpose = "AVATAR" | "MESSAGE";

export type UploadedFile = {
  id: number;
  originalName: string;
  contentType: string;
  sizeBytes: number;
};

/**
 * 인증이 필요한 파일 URL을 반환한다.
 */
export function getFileUrl(fileId: number, download = false): string {
  const params = download ? "?download=true" : "";

  return `${getApiUrl()}/api/files/${fileId}${params}`;
}

/**
 * 파일 업로드 API 오류 메시지를 반환한다.
 */
async function readUploadErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      message?: string;
      detail?: string;
      error?: string;
    };

    if (body.message) {
      return body.message;
    }

    if (body.detail) {
      return body.detail;
    }

    if (body.error) {
      return body.error;
    }
  } catch {
    // ignore parse errors
  }

  if (response.status === 413) {
    return "파일 크기가 너무 큽니다.";
  }

  if (response.status === 401) {
    return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
  }

  return "이미지 업로드에 실패했습니다.";
}

/**
 * 이미지 파일을 업로드한다.
 */
export async function uploadFiles(
  purpose: FilePurpose,
  files: File[],
): Promise<{ files: UploadedFile[] } | { errorMessage: string }> {
  const token = await ensureAccessToken();

  if (!token || files.length === 0) {
    return { errorMessage: "이미지 업로드에 실패했습니다." };
  }

  const formData = new FormData();

  formData.set("purpose", purpose);

  for (const file of files) {
    formData.append("files", file);
  }

  try {
    const response = await apiFetch(
      `${getApiUrl()}/api/files`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        cache: "no-store",
      },
      FILE_UPLOAD_TIMEOUT_MS,
    );

    if (!response.ok) {
      return { errorMessage: await readUploadErrorMessage(response) };
    }

    const payload = (await response.json()) as { files: UploadedFile[] };

    return { files: payload.files };
  } catch {
    return { errorMessage: "이미지 업로드 중 네트워크 오류가 발생했습니다." };
  }
}

/**
 * 인증 헤더로 파일 blob을 조회한다.
 */
export async function fetchAuthenticatedFileBlob(
  fileId: number,
  download = false,
): Promise<Blob | null> {
  const token = await ensureAccessToken();

  if (!token) {
    return null;
  }

  try {
    const response = await apiFetch(
      getFileUrl(fileId, download),
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      },
      FILE_FETCH_TIMEOUT_MS,
    );

    if (!response.ok) {
      return null;
    }

    return response.blob();
  } catch {
    return null;
  }
}

/**
 * 파일을 다운로드한다.
 */
export async function downloadFile(fileId: number, fileName: string): Promise<boolean> {
  const blob = await fetchAuthenticatedFileBlob(fileId, true);

  if (!blob || globalThis.window === undefined) {
    return false;
  }

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);

  return true;
}

/**
 * 중복 파일명을 구분한다.
 */
function resolveUniqueFileName(fileName: string, usedNames: Map<string, number>): string {
  const usedCount = usedNames.get(fileName) ?? 0;

  usedNames.set(fileName, usedCount + 1);

  if (usedCount === 0) {
    return fileName;
  }

  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex <= 0) {
    return `${fileName} (${usedCount + 1})`;
  }

  const baseName = fileName.slice(0, dotIndex);
  const extension = fileName.slice(dotIndex);

  return `${baseName} (${usedCount + 1})${extension}`;
}

/**
 * 여러 파일을 순차 다운로드한다.
 */
export async function downloadFiles(
  files: { id: number; originalName: string }[],
): Promise<{ successCount: number; failedCount: number }> {
  let successCount = 0;
  let failedCount = 0;
  const usedNames = new Map<string, number>();

  for (const file of files) {
    const fileName = resolveUniqueFileName(file.originalName, usedNames);
    const success = await downloadFile(file.id, fileName);

    if (success) {
      successCount += 1;
    } else {
      failedCount += 1;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 150);
    });
  }

  return { successCount, failedCount };
}

/**
 * 프로필 사진을 업로드한다.
 */
export async function uploadAvatar(file: File): Promise<AuthUser | null> {
  const token = await ensureAccessToken();

  if (!token) {
    return null;
  }

  const formData = new FormData();

  formData.set("file", file);

  try {
    const response = await apiFetch(`${getApiUrl()}/api/users/me/avatar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      cache: "no-store",
    }, FILE_UPLOAD_TIMEOUT_MS);

    if (!response.ok) {
      return null;
    }

    return normalizeAuthUser((await response.json()) as AuthUser);
  } catch {
    return null;
  }
}
