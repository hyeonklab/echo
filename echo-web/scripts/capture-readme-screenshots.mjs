import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { resolveScreenshotAuth } from "./readme-screenshot-auth.mjs";
import {
  CLUB_GROUP_ROOM_NAME,
  FAMILY_GROUP_ROOM_NAME,
  GIRLFRIEND_PEER_NAME,
  GROUP_CHAT_ROOM_NAME,
  IMAGE_PREVIEW_PEER_NAME,
  LINK_PREVIEW_PEER_NAME,
  PROFESSOR_PEER_NAME,
} from "./screenshot-demo-data.mjs";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "../..");
const outputDir = path.join(repoRoot, "docs", "screenshots");

const viewport = { width: 1440, height: 900 };

const screenshots = [
  { name: "login", path: "/login", requiresAuth: false, theme: "dark" },
  { name: "home", path: "/home", requiresAuth: true, theme: "dark" },
  { name: "friends", path: "/friends", requiresAuth: true, theme: "dark" },
  { name: "chat-list", path: "/chat", requiresAuth: true, theme: "dark" },
];

/** 테마 소개 스크린샷 (홈 프로필의 테마 선택 UI) */
const themeScreenshots = [
  { name: "theme-light", path: "/home", requiresAuth: true, theme: "light", colorScheme: "light" },
  { name: "theme-dark", path: "/home", requiresAuth: true, theme: "dark", colorScheme: "dark" },
];

/** README 채팅방 스크린샷 */
const chatRoomScreenshots = [
  {
    name: "chat-room-link-preview",
    roomName: process.env.SCREENSHOT_LINK_PEER_NAME ?? LINK_PREVIEW_PEER_NAME,
    roomType: "DM",
    readyAfterInput: ".flex-1.overflow-y-auto a[target='_blank'] p.font-semibold",
  },
  {
    name: "chat-room-image-preview",
    roomName: process.env.SCREENSHOT_IMAGE_PEER_NAME ?? IMAGE_PREVIEW_PEER_NAME,
    roomType: "DM",
    readyAfterInput: ".flex-1.overflow-y-auto img.object-cover",
  },
  {
    name: "chat-room-group",
    roomName: process.env.SCREENSHOT_GROUP_ROOM_NAME ?? GROUP_CHAT_ROOM_NAME,
    roomType: "GROUP",
    readyAfterInput: "input[placeholder='메시지를 입력하세요']",
  },
  {
    name: "chat-room-girlfriend",
    roomName: process.env.SCREENSHOT_GIRLFRIEND_PEER_NAME ?? GIRLFRIEND_PEER_NAME,
    roomType: "DM",
    readyAfterInput: "input[placeholder='메시지를 입력하세요']",
  },
  {
    name: "chat-room-professor",
    roomName: process.env.SCREENSHOT_PROFESSOR_PEER_NAME ?? PROFESSOR_PEER_NAME,
    roomType: "DM",
    readyAfterInput: "input[placeholder='메시지를 입력하세요']",
  },
  {
    name: "chat-room-club",
    roomName: process.env.SCREENSHOT_CLUB_ROOM_NAME ?? CLUB_GROUP_ROOM_NAME,
    roomType: "GROUP",
    readyAfterInput: "input[placeholder='메시지를 입력하세요']",
  },
  {
    name: "chat-room-family",
    roomName: process.env.SCREENSHOT_FAMILY_ROOM_NAME ?? FAMILY_GROUP_ROOM_NAME,
    roomType: "GROUP",
    readyAfterInput: "input[placeholder='메시지를 입력하세요']",
  },
];

/**
 * 채팅방 목록에서 이름·유형으로 roomId를 찾는다.
 */
async function resolveDemoRoomId(apiUrl, accessToken, roomName, roomType) {
  const response = await fetch(`${apiUrl}/api/rooms`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`채팅방 목록 조회 실패: HTTP ${response.status}`);
  }

  const rooms = await response.json();
  const room = rooms.find((item) => item.name === roomName && item.type === roomType);

  return room?.id ?? null;
}

/**
 * 페이지 로딩이 끝날 때까지 대기한다.
 */
async function waitForScreen(page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(1200);
}

/**
 * 컨텍스트에 JWT를 주입한다. (첫 navigation 전에 등록)
 */
async function injectAuthTokens(context, accessToken, refreshToken) {
  await context.addInitScript(
    ({ accessTokenValue, refreshTokenValue }) => {
      localStorage.setItem("accessToken", accessTokenValue);
      localStorage.setItem("refreshToken", refreshTokenValue);
    },
    {
      accessTokenValue: accessToken,
      refreshTokenValue: refreshToken,
    },
  );
}

/**
 * localStorage에 테마를 주입한다. (첫 navigation 전에 등록)
 */
async function injectThemePreference(context, theme) {
  await context.addInitScript((themeValue) => {
    const storageKey = "echo-theme";

    localStorage.setItem(storageKey, themeValue);

    let resolved = themeValue;

    if (themeValue === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
    document.documentElement.dataset.theme = themeValue;
  }, theme);
}

/**
 * 인증이 필요한 화면이 준비될 때까지 대기한다.
 */
async function waitForAuthenticatedScreen(page, target) {
  if (!target.requiresAuth) {
    return;
  }

  const readySelectorByName = {
    home: "text=로그인됨",
    friends: "h1:has-text('친구')",
    "chat-list": "text=내 채팅방",
    "theme-light": "[aria-label='테마 선택']",
    "theme-dark": "[aria-label='테마 선택']",
    "chat-room-link-preview": "input[placeholder='메시지를 입력하세요']",
    "chat-room-image-preview": "input[placeholder='메시지를 입력하세요']",
    "chat-room-group": "input[placeholder='메시지를 입력하세요']",
    "chat-room-girlfriend": "input[placeholder='메시지를 입력하세요']",
    "chat-room-professor": "input[placeholder='메시지를 입력하세요']",
    "chat-room-club": "input[placeholder='메시지를 입력하세요']",
    "chat-room-family": "input[placeholder='메시지를 입력하세요']",
  };

  const selector = readySelectorByName[target.name];

  if (!selector) {
    return;
  }

  try {
    await page.locator(selector).first().waitFor({ state: "visible", timeout: 20000 });
  } catch {
    const bodyPreview = (await page.locator("body").innerText()).slice(0, 200);
    throw new Error(
      `${target.name} 화면 인증 대기 실패. CORS와 FRONTEND_URL/SCREENSHOT_BASE_URL을 확인해 주세요.\n${bodyPreview}`,
    );
  }
}

/**
 * 채팅방 메시지 영역을 맨 아래로 스크롤하고 미리보기 로딩을 기다린다.
 */
async function waitForChatRoomContent(page, target) {
  const messagesScroller = page.locator(".flex-1.overflow-y-auto").first();

  await messagesScroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  if (!target.readyAfterInput) {
    return;
  }

  try {
    await page.locator(target.readyAfterInput).first().waitFor({ state: "visible", timeout: 25000 });
  } catch {
    const bodyPreview = (await page.locator("body").innerText()).slice(0, 300);
    throw new Error(
      `${target.name} 미리보기 로딩 실패 (roomId=${target.roomId}).\n${bodyPreview}`,
    );
  }

  if (target.name === "chat-room-image-preview") {
    await page.waitForTimeout(2500);
  } else {
    await page.waitForTimeout(800);
  }
}

/**
 * README용 스크린샷을 캡처한다.
 */
async function captureScreenshot(browser, baseUrl, target, accessToken, refreshToken) {
  const context = await browser.newContext({
    viewport,
    colorScheme: target.colorScheme ?? "dark",
    deviceScaleFactor: 1,
  });

  if (target.theme) {
    await injectThemePreference(context, target.theme);
  }

  if (target.requiresAuth) {
    await injectAuthTokens(context, accessToken, refreshToken);
  }

  const page = await context.newPage();

  await page.goto(`${baseUrl}${target.path}`, { waitUntil: "domcontentloaded" });
  await waitForAuthenticatedScreen(page, target);

  if (target.name === "theme-light" || target.name === "theme-dark") {
    const expectedTheme = target.theme;
    const hasDarkClass = await page.evaluate(() => document.documentElement.classList.contains("dark"));

    if (expectedTheme === "light" && hasDarkClass) {
      throw new Error(`${target.name} 캡처 실패: 라이트 테마인데 html에 dark 클래스가 남아 있습니다.`);
    }

    if (expectedTheme === "dark" && !hasDarkClass) {
      throw new Error(`${target.name} 캡처 실패: 다크 테마인데 html에 dark 클래스가 없습니다.`);
    }
  }

  if (target.roomId != null) {
    await waitForChatRoomContent(page, target);
  }

  await waitForScreen(page);

  const outputPath = path.join(outputDir, `${target.name}.png`);
  await page.screenshot({ path: outputPath, fullPage: false });
  await context.close();

  return outputPath;
}

async function main() {
  const filterNames = new Set(process.argv.slice(2));

  function matchesFilter(name) {
    if (filterNames.size === 0) {
      return true;
    }

    return filterNames.has(name);
  }

  const { accessToken, refreshToken, apiUrl, baseUrl } = resolveScreenshotAuth();

  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`screenshot baseUrl=${baseUrl}`);

  const browser = await chromium.launch({ headless: true });

  try {
    for (const target of screenshots) {
      if (!matchesFilter(target.name)) {
        continue;
      }

      const outputPath = await captureScreenshot(browser, baseUrl, target, accessToken, refreshToken);
      console.log(`saved ${outputPath}`);
    }

    for (const target of themeScreenshots) {
      if (!matchesFilter(target.name)) {
        continue;
      }

      const outputPath = await captureScreenshot(browser, baseUrl, target, accessToken, refreshToken);
      console.log(`saved ${outputPath} (theme=${target.theme})`);
    }

    for (const roomTarget of chatRoomScreenshots) {
      if (!matchesFilter(roomTarget.name)) {
        continue;
      }

      const roomId = await resolveDemoRoomId(
        apiUrl,
        accessToken,
        roomTarget.roomName,
        roomTarget.roomType,
      );

      if (roomId == null) {
        throw new Error(`더미 채팅방을 찾지 못했습니다: ${roomTarget.roomName} (${roomTarget.roomType})`);
      }

      const outputPath = await captureScreenshot(
        browser,
        baseUrl,
        {
          name: roomTarget.name,
          path: `/chat/${roomId}`,
          requiresAuth: true,
          theme: "dark",
          roomId,
          readyAfterInput: roomTarget.readyAfterInput,
        },
        accessToken,
        refreshToken,
      );
      console.log(`saved ${outputPath} (room=${roomTarget.roomName}, roomId=${roomId})`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
