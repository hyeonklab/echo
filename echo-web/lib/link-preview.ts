import { ensureAccessToken } from "@/lib/auth";
import { apiFetch, getApiUrl } from "@/lib/api";

export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
};

export type LinkMatch = {
  raw: string;
  href: string;
  start: number;
  end: number;
};

const SCHEME_URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const BARE_DOMAIN_PATTERN =
  /(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,}(?:\/[^\s<>"']*)?/gi;

const previewCache = new Map<string, LinkPreview | null>();
const pendingRequests = new Map<string, Promise<LinkPreview | null>>();

/**
 * URL 끝의 문장부호를 제거한다.
 */
export function normalizeUrl(url: string): string {
  return url.replace(/[.,;:!?)]+$/u, "");
}

/**
 * 상대 URL을 https 절대 URL로 변환한다.
 */
export function toAbsoluteUrl(url: string): string {
  const trimmed = normalizeUrl(url.trim());

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

/**
 * 링크 구간이 유효한지 검사한다.
 */
function isValidLinkMatch(text: string, start: number, end: number): boolean {
  if (start > 0 && text[start - 1] === "@") {
    return false;
  }

  return end > start;
}

/**
 * 텍스트에서 링크 구간 목록을 추출한다.
 */
export function findLinkMatches(text: string): LinkMatch[] {
  const matches: LinkMatch[] = [];
  const occupied = new Array<boolean>(text.length).fill(false);

  function addMatch(rawValue: string, start: number) {
    const raw = normalizeUrl(rawValue);
    const end = start + rawValue.length;

    if (!isValidLinkMatch(text, start, end)) {
      return;
    }

    for (let index = start; index < end; index += 1) {
      if (occupied[index]) {
        return;
      }
    }

    for (let index = start; index < end; index += 1) {
      occupied[index] = true;
    }

    matches.push({
      raw,
      href: toAbsoluteUrl(raw),
      start,
      end,
    });
  }

  for (const match of text.matchAll(SCHEME_URL_PATTERN)) {
    if (match.index == null) {
      continue;
    }

    addMatch(match[0], match.index);
  }

  for (const match of text.matchAll(BARE_DOMAIN_PATTERN)) {
    if (match.index == null) {
      continue;
    }

    addMatch(match[0], match.index);
  }

  return matches.sort((left, right) => left.start - right.start);
}

/**
 * 텍스트에서 URL 목록을 추출한다.
 */
export function extractUrls(text: string): string[] {
  return [...new Set(findLinkMatches(text).map((item) => item.href))];
}

/**
 * 텍스트에서 첫 번째 URL을 반환한다.
 */
export function extractFirstUrl(text: string): string | null {
  const urls = extractUrls(text);

  if (urls.length === 0) {
    return null;
  }

  return urls[0];
}

/**
 * 링크 미리보기 메타데이터를 조회한다.
 */
export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  const normalizedUrl = toAbsoluteUrl(url);

  if (previewCache.has(normalizedUrl)) {
    return previewCache.get(normalizedUrl) ?? null;
  }

  const pending = pendingRequests.get(normalizedUrl);

  if (pending !== undefined) {
    return pending;
  }

  const request = loadLinkPreview(normalizedUrl).finally(() => {
    pendingRequests.delete(normalizedUrl);
  });

  pendingRequests.set(normalizedUrl, request);

  return request;
}

async function loadLinkPreview(url: string): Promise<LinkPreview | null> {
  const token = await ensureAccessToken();

  if (!token) {
    return null;
  }

  const params = new URLSearchParams({ url });
  const response = await apiFetch(`${getApiUrl()}/api/link-preview?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    previewCache.set(url, null);
    return null;
  }

  const preview = (await response.json()) as LinkPreview;
  previewCache.set(url, preview);

  return preview;
}

/**
 * 미리보기에 표시할 최소 정보가 있는지 확인한다.
 */
export function hasLinkPreviewContent(preview: LinkPreview): boolean {
  return Boolean(preview.title || preview.description || preview.imageUrl);
}

/**
 * URL에서 표시용 호스트명을 반환한다.
 */
export function formatLinkHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * 설명 텍스트를 미리보기용 길이로 자른다.
 */
export function truncatePreviewText(text: string, maxLength = 140): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}
