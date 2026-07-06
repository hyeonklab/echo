import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import jwt from "jsonwebtoken";

import { SCREENSHOT_DEMO_EMAIL } from "./screenshot-demo-data.mjs";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "../..");

/**
 * .env 파일을 파싱한다.
 */
export function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const env = {};

  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    env[trimmed.slice(0, separatorIndex)] = trimmed.slice(separatorIndex + 1);
  }

  return env;
}

/**
 * 로컬 PostgreSQL에서 스크린샷용 더미 사용자를 조회한다.
 */
export function fetchScreenshotUser(env) {
  const dbUser = env.ECHO_DB_USER ?? "echo";
  const dbName = env.ECHO_DB_NAME ?? "echo";
  const demoEmail = process.env.SCREENSHOT_DEMO_EMAIL ?? SCREENSHOT_DEMO_EMAIL;
  const sql = `SELECT id, COALESCE(email, ''), display_name FROM users WHERE email = '${demoEmail}' LIMIT 1;`;

  try {
    const output = execSync(
      `docker compose exec -T postgres psql -U ${dbUser} -d ${dbName} -t -A -F"," -c "${sql}"`,
      { cwd: repoRoot, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();

    if (!output) {
      return null;
    }

    const [id, email, displayName] = output.split(",");

    return {
      id: Number(id),
      email: email.length > 0 ? email : null,
      displayName,
    };
  } catch {
    return null;
  }
}

/**
 * Echo 백엔드와 호환되는 JWT를 생성한다.
 */
export function createScreenshotTokens(user, secret) {
  const accessToken = jwt.sign(
    {
      type: "access",
      email: user.email,
      displayName: user.displayName,
    },
    secret,
    {
      subject: String(user.id),
      expiresIn: "1h",
    },
  );

  const refreshToken = jwt.sign(
    {
      type: "refresh",
      email: user.email,
      displayName: user.displayName,
    },
    secret,
    {
      subject: String(user.id),
      expiresIn: "7d",
    },
  );

  return { accessToken, refreshToken };
}

/**
 * 프론트엔드 URL에서 API base URL을 유도한다.
 */
export function deriveApiUrlFromFrontend(frontendUrl) {
  try {
    const url = new URL(frontendUrl);

    return `${url.protocol}//${url.hostname}:8080`;
  } catch {
    return "http://localhost:8080";
  }
}

/**
 * README 스크린샷 캡처에 사용할 프론트엔드 URL을 반환한다.
 * 백엔드 CORS는 FRONTEND_URL과 일치해야 브라우저 API 호출이 성공한다.
 */
export function resolveScreenshotBaseUrl(env = loadEnvFile(path.join(repoRoot, ".env"))) {
  return (
    process.env.SCREENSHOT_BASE_URL ??
    process.env.FRONTEND_URL ??
    env.FRONTEND_URL ??
    "http://localhost:3000"
  );
}

/**
 * README 스크린샷용 인증 정보를 준비한다.
 */
export function resolveScreenshotAuth() {
  const env = loadEnvFile(path.join(repoRoot, ".env"));
  const secret = process.env.JWT_SECRET ?? env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET이 없습니다. Echo 루트 .env를 확인해 주세요.");
  }

  const user = fetchScreenshotUser(env);

  if (!user) {
    throw new Error(
      "스크린샷 더미 사용자를 찾지 못했습니다. `npm run screenshots:seed`를 먼저 실행해 주세요.",
    );
  }

  const baseUrl = resolveScreenshotBaseUrl(env);
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ??
    env.NEXT_PUBLIC_API_URL ??
    deriveApiUrlFromFrontend(baseUrl);

  return {
    user,
    baseUrl,
    ...createScreenshotTokens(user, secret),
    apiUrl,
  };
}
