import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLUB_GROUP_ROOM_NAME,
  FAMILY_GROUP_ROOM_NAME,
  GROUP_CHAT_ROOM_NAME,
  IMAGE_PREVIEW_PEER_NAME,
  LINK_PREVIEW_PEER_NAME,
  PUBLIC_DEMO_IMAGE_SOURCES,
  SCREENSHOT_DEMO_EMAIL,
  SCREENSHOT_DEMO_USERS,
} from "./screenshot-demo-data.mjs";
import {
  createScreenshotTokens,
  deriveApiUrlFromFrontend,
  loadEnvFile,
  resolveScreenshotBaseUrl,
} from "./readme-screenshot-auth.mjs";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "../..");

/**
 * PostgreSQL에 SQL을 실행한다.
 */
function runPsql(sql, env) {
  const dbUser = env.ECHO_DB_USER ?? "echo";
  const dbName = env.ECHO_DB_NAME ?? "echo";

  execSync(`docker compose exec -T postgres psql -U ${dbUser} -d ${dbName} -v ON_ERROR_STOP=1`, {
    cwd: repoRoot,
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

/**
 * 스크린샷 더미 사용자 데이터를 정리한다.
 */
function cleanupDemoUsers(env) {
  const sql = `
    BEGIN;

    CREATE TEMP TABLE screenshot_demo_users AS
    SELECT id FROM users WHERE provider_id LIKE 'screenshot-%';

    CREATE TEMP TABLE screenshot_demo_rooms AS
    SELECT rm.room_id
    FROM room_members rm
    GROUP BY rm.room_id
    HAVING bool_and(rm.user_id IN (SELECT id FROM screenshot_demo_users));

    DELETE FROM message_attachments
    WHERE message_id IN (
      SELECT m.id FROM messages m
      WHERE m.room_id IN (SELECT room_id FROM screenshot_demo_rooms)
    );

    DELETE FROM message_hidden
    WHERE user_id IN (SELECT id FROM screenshot_demo_users)
       OR message_id IN (
         SELECT m.id FROM messages m
         WHERE m.room_id IN (SELECT room_id FROM screenshot_demo_rooms)
       );

    DELETE FROM messages
    WHERE room_id IN (SELECT room_id FROM screenshot_demo_rooms);

    DELETE FROM room_read_states
    WHERE user_id IN (SELECT id FROM screenshot_demo_users)
       OR room_id IN (SELECT room_id FROM screenshot_demo_rooms);

    DELETE FROM room_hidden
    WHERE user_id IN (SELECT id FROM screenshot_demo_users)
       OR room_id IN (SELECT room_id FROM screenshot_demo_rooms);

    DELETE FROM room_members
    WHERE room_id IN (SELECT room_id FROM screenshot_demo_rooms);

    DELETE FROM rooms
    WHERE id IN (SELECT room_id FROM screenshot_demo_rooms);

    DELETE FROM friends
    WHERE owner_user_id IN (SELECT id FROM screenshot_demo_users)
       OR friend_user_id IN (SELECT id FROM screenshot_demo_users);

    DELETE FROM stored_files
    WHERE owner_user_id IN (SELECT id FROM screenshot_demo_users);

    DELETE FROM users
    WHERE provider_id LIKE 'screenshot-%';

    COMMIT;
  `;

  runPsql(sql, env);
}

/**
 * 스크린샷 더미 사용자를 삽입한다.
 */
function insertDemoUsers(env) {
  const values = SCREENSHOT_DEMO_USERS.map(
    (user) =>
      `('${user.email}', '${user.displayName}', 'LOCAL', '${user.providerId}')`,
  ).join(",\n");

  runPsql(
    `
    INSERT INTO users (email, display_name, provider, provider_id)
    VALUES
    ${values};
    `,
    env,
  );
}

/**
 * 이메일로 사용자 ID를 조회한다.
 */
function fetchUserIdByEmail(email, env) {
  const dbUser = env.ECHO_DB_USER ?? "echo";
  const dbName = env.ECHO_DB_NAME ?? "echo";
  const output = execSync(`docker compose exec -T postgres psql -U ${dbUser} -d ${dbName} -t -A`, {
    cwd: repoRoot,
    input: `SELECT id FROM users WHERE email = '${email}' LIMIT 1;`,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();

  return output ? Number(output) : null;
}

/**
 * 인증 API JSON 요청을 보낸다.
 */
async function apiJson(url, token, method, body) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body == null ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${method} ${url} failed: HTTP ${response.status} ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

/**
 * 공개 이미지 URL에서 파일을 받아 업로드한다.
 */
async function downloadPublicImage(source) {
  const imageResponse = await fetch(source.url, {
    redirect: "follow",
    cache: "no-store",
    headers: {
      "User-Agent": "Echo-Screenshot-Seed/1.0",
    },
  });

  if (!imageResponse.ok) {
    throw new Error(`공개 이미지 다운로드 실패: ${source.url}`);
  }

  const bytes = await imageResponse.arrayBuffer();
  const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";

  return {
    bytes,
    contentType,
    name: source.name,
  };
}

/**
 * 공개 이미지 URL에서 프로필 사진을 업로드한다.
 */
async function uploadAvatarFromUrl(apiUrl, token, source) {
  const { bytes, contentType, name } = await downloadPublicImage(source);
  const formData = new FormData();
  formData.append("file", new Blob([bytes], { type: contentType }), name);

  const response = await fetch(`${apiUrl}/api/users/me/avatar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`프로필 사진 업로드 실패: HTTP ${response.status} ${text}`);
  }

  return response.json();
}

/**
 * 공개 이미지 URL에서 파일을 받아 업로드한다.
 */
async function uploadPublicImages(apiUrl, token, sources) {
  const fileIds = [];

  for (const source of sources) {
    const { bytes, contentType, name } = await downloadPublicImage(source);
    const formData = new FormData();
    formData.append("purpose", "MESSAGE");
    formData.append("files", new Blob([bytes], { type: contentType }), name);

    const response = await fetch(`${apiUrl}/api/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`이미지 업로드 실패: HTTP ${response.status} ${text}`);
    }

    const payload = await response.json();
    fileIds.push(payload.files[0].id);
  }

  return fileIds;
}

/**
 * DM 채팅방을 생성하거나 조회한다.
 */
async function createDmRoom(apiUrl, token, targetUserId) {
  return apiJson(`${apiUrl}/api/rooms/dm`, token, "POST", { targetUserId });
}

/**
 * 그룹 채팅방을 생성한다.
 */
async function createGroupRoom(apiUrl, token, name, memberUserIds) {
  return apiJson(`${apiUrl}/api/rooms`, token, "POST", { name, memberUserIds });
}

/**
 * 채팅방에 메시지를 전송한다.
 */
async function sendMessage(apiUrl, token, roomId, content, attachmentIds = []) {
  return apiJson(`${apiUrl}/api/rooms/${roomId}/messages`, token, "POST", {
    content,
    attachmentIds,
  });
}

/**
 * API로 더미 친구·채팅·메시지를 구성한다.
 */
async function seedDemoContent(env, secret, apiUrl) {
  const usersByEmail = Object.fromEntries(
    SCREENSHOT_DEMO_USERS.map((user) => {
      const id = fetchUserIdByEmail(user.email, env);

      if (id == null) {
        throw new Error(`더미 사용자를 찾지 못했습니다: ${user.email}`);
      }

      return [
        user.email,
        {
          ...user,
          id,
          accessToken: createScreenshotTokens(
            { id, email: user.email, displayName: user.displayName },
            secret,
          ).accessToken,
        },
      ];
    }),
  );

  const demoUser = usersByEmail[SCREENSHOT_DEMO_EMAIL];
  const minji = usersByEmail["minji@example.com"];
  const junho = usersByEmail["junho@example.com"];
  const seoyeon = usersByEmail["seoyeon@example.com"];
  const hyunwoo = usersByEmail["hyunwoo@example.com"];
  const yerin = usersByEmail["yerin@example.com"];
  const taemin = usersByEmail["taemin@example.com"];
  const subin = usersByEmail["subin@example.com"];
  const donghyun = usersByEmail["donghyun@example.com"];
  const jia = usersByEmail["jia@example.com"];
  const minseok = usersByEmail["minseok@example.com"];
  const mom = usersByEmail["mom@example.com"];
  const dad = usersByEmail["dad@example.com"];
  const sibling = usersByEmail["sibling@example.com"];
  const professor = usersByEmail["professor@example.com"];
  const sua = usersByEmail["sua@example.com"];

  const collegeFriendEmails = [
    "minji@example.com",
    "junho@example.com",
    "seoyeon@example.com",
    "hyunwoo@example.com",
    "yerin@example.com",
    "taemin@example.com",
    "subin@example.com",
    "donghyun@example.com",
    "jia@example.com",
    "minseok@example.com",
  ];
  const collegeGroupMemberIds = collegeFriendEmails.map((email) => usersByEmail[email].id);

  for (const user of SCREENSHOT_DEMO_USERS) {
    if (!user.avatar) {
      continue;
    }

    const entry = usersByEmail[user.email];

    await uploadAvatarFromUrl(apiUrl, entry.accessToken, user.avatar);
  }

  for (const user of SCREENSHOT_DEMO_USERS) {
    if (user.email === SCREENSHOT_DEMO_EMAIL) {
      continue;
    }

    await apiJson(`${apiUrl}/api/friends`, demoUser.accessToken, "POST", {
      targetUserId: usersByEmail[user.email].id,
    });
  }

  // 오래된 방부터 시드 (최근 메시지가 목록 상단에 오도록)
  const selfRoom = await createDmRoom(apiUrl, demoUser.accessToken, demoUser.id);
  await sendMessage(apiUrl, demoUser.accessToken, selfRoom.id, "이번 주 할 일");
  await sendMessage(apiUrl, demoUser.accessToken, selfRoom.id, "- 전공 중간 범위 정리\n- 교양 팀플 발표 목차");

  const professorRoom = await createDmRoom(apiUrl, demoUser.accessToken, professor.id);
  await sendMessage(
    apiUrl,
    professor.accessToken,
    professorRoom.id,
    "이번 주 금요일 보강 수업 있습니다. 과제 제출 기한도 그대로입니다.",
  );
  await sendMessage(apiUrl, demoUser.accessToken, professorRoom.id, "네 교수님 확인했습니다");

  const seoyeonRoom = await createDmRoom(apiUrl, demoUser.accessToken, seoyeon.id);
  await sendMessage(apiUrl, demoUser.accessToken, seoyeonRoom.id, "방학에 다녀온 여행 사진 몇 장");
  const attachmentIds = await uploadPublicImages(
    apiUrl,
    demoUser.accessToken,
    PUBLIC_DEMO_IMAGE_SOURCES,
  );
  await sendMessage(apiUrl, demoUser.accessToken, seoyeonRoom.id, "", attachmentIds);
  await sendMessage(apiUrl, seoyeon.accessToken, seoyeonRoom.id, "와 풍경 미쳤다 얼마나 다녀옴?");
  await sendMessage(apiUrl, demoUser.accessToken, seoyeonRoom.id, "2주 정도 다녀옴");

  const junhoRoom = await createDmRoom(apiUrl, demoUser.accessToken, junho.id);
  await sendMessage(apiUrl, demoUser.accessToken, junhoRoom.id, "준호야 웹프 과제 레퍼런스인데 이거 봐줘");
  await sendMessage(
    apiUrl,
    demoUser.accessToken,
    junhoRoom.id,
    "https://ui.shadcn.com/docs/installation/next",
  );
  await sendMessage(apiUrl, junho.accessToken, junhoRoom.id, "오 이거 진짜 깔끔함 발표 때 참고하기 좋겠다");
  await sendMessage(apiUrl, demoUser.accessToken, junhoRoom.id, "ㅇㅋ 발표 자료 정리할 때 같이 보자");

  const minjiRoom = await createDmRoom(apiUrl, demoUser.accessToken, minji.id);
  await sendMessage(apiUrl, demoUser.accessToken, minjiRoom.id, "민지야 이번 주말 시간 됨?");
  await sendMessage(apiUrl, minji.accessToken, minjiRoom.id, "ㅇㅋ 토욜만 되면 됨");
  await sendMessage(apiUrl, demoUser.accessToken, minjiRoom.id, "그럼 토욜에 카페 ㄱ");

  const clubRoom = await createGroupRoom(apiUrl, demoUser.accessToken, CLUB_GROUP_ROOM_NAME, [
    demoUser.id,
    taemin.id,
    hyunwoo.id,
    yerin.id,
  ]);
  await sendMessage(apiUrl, taemin.accessToken, clubRoom.id, "이번 주 금요일 연습 7시 맞지?");
  await sendMessage(apiUrl, hyunwoo.accessToken, clubRoom.id, "ㅇㅇ 그때 봄");
  await sendMessage(apiUrl, yerin.accessToken, clubRoom.id, "나 약간 늦을 수 있음");
  await sendMessage(apiUrl, demoUser.accessToken, clubRoom.id, "ㅇㅋ 일단 맞춰볼게");

  const groupRoom = await createGroupRoom(
    apiUrl,
    demoUser.accessToken,
    GROUP_CHAT_ROOM_NAME,
    collegeGroupMemberIds,
  );
  await sendMessage(apiUrl, demoUser.accessToken, groupRoom.id, "다들 중간 준비 됨? 나 전공 시험 다음 주임");
  await sendMessage(apiUrl, minji.accessToken, groupRoom.id, "교양 레포 반도 못함 ㅜㅜ");
  await sendMessage(apiUrl, junho.accessToken, groupRoom.id, "전공 실습 과제 제출하러 감");
  await sendMessage(apiUrl, seoyeon.accessToken, groupRoom.id, "축제 부스 준비 때문에 진짜 개바쁨");
  await sendMessage(apiUrl, hyunwoo.accessToken, groupRoom.id, "교양 팀플 발표 연습 중인데 머리 터질 듯");
  await sendMessage(apiUrl, yerin.accessToken, groupRoom.id, "시험 끝나고 축제 가자");
  await sendMessage(apiUrl, taemin.accessToken, groupRoom.id, "동아리 연습 끝나고 옴");
  await sendMessage(apiUrl, subin.accessToken, groupRoom.id, "도서관 자리 잡기 전쟁 수준");
  await sendMessage(apiUrl, donghyun.accessToken, groupRoom.id, "전공 교수님 시험 범위 또 늘리심...");
  await sendMessage(apiUrl, jia.accessToken, groupRoom.id, "나 일단 카공 ㄱ");
  await sendMessage(apiUrl, minseok.accessToken, groupRoom.id, "다들 개빡세네 버텨");
  await sendMessage(apiUrl, demoUser.accessToken, groupRoom.id, "시험 끝나면 술 ㄱㄱ");

  const momRoom = await createDmRoom(apiUrl, demoUser.accessToken, mom.id);
  await sendMessage(apiUrl, mom.accessToken, momRoom.id, "이번 주말에 한번 내려올래?");
  await sendMessage(apiUrl, demoUser.accessToken, momRoom.id, "토욜은 약속 있는데 일욜은 됨");
  await sendMessage(apiUrl, mom.accessToken, momRoom.id, "그럼 일욜 저녁에 밥 해놓을게");

  const familyRoom = await createGroupRoom(apiUrl, demoUser.accessToken, FAMILY_GROUP_ROOM_NAME, [
    demoUser.id,
    mom.id,
    dad.id,
    sibling.id,
  ]);
  await sendMessage(apiUrl, dad.accessToken, familyRoom.id, "이번 달 관리비 나왔네");
  await sendMessage(apiUrl, mom.accessToken, familyRoom.id, "지훈아 장 볼 거 있으면 적어");
  await sendMessage(apiUrl, sibling.accessToken, familyRoom.id, "나 학원 끝나고 9시쯤 옴");
  await sendMessage(apiUrl, mom.accessToken, familyRoom.id, "저녁 다 됐어 빨리 들어와");

  const suaRoom = await createDmRoom(apiUrl, demoUser.accessToken, sua.id);
  await sendMessage(apiUrl, sua.accessToken, suaRoom.id, "오늘 뭐해?");
  await sendMessage(apiUrl, demoUser.accessToken, suaRoom.id, "과제 중 ㅜㅜ");
  await sendMessage(apiUrl, sua.accessToken, suaRoom.id, "그럼 토욜에 영화 보러 갈래?");
  await sendMessage(apiUrl, demoUser.accessToken, suaRoom.id, "ㅇㅋ 토욜에 봐");

  console.log(
    `seeded demo rooms: link=${junhoRoom.id}(${LINK_PREVIEW_PEER_NAME}), image=${seoyeonRoom.id}(${IMAGE_PREVIEW_PEER_NAME}), group=${groupRoom.id}(${GROUP_CHAT_ROOM_NAME}), family=${familyRoom.id}(${FAMILY_GROUP_ROOM_NAME}), club=${clubRoom.id}(${CLUB_GROUP_ROOM_NAME})`,
  );
}

/**
 * 백엔드 헬스 체크를 수행한다.
 */
async function assertApiReady(apiUrl) {
  const response = await fetch(`${apiUrl}/api/health`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`백엔드가 실행 중이 아닙니다: ${apiUrl}/api/health`);
  }
}

async function main() {
  const env = loadEnvFile(path.join(repoRoot, ".env"));
  const secret = process.env.JWT_SECRET ?? env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET이 없습니다. Echo 루트 .env를 확인해 주세요.");
  }

  const baseUrl = resolveScreenshotBaseUrl(env);
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ??
    env.NEXT_PUBLIC_API_URL ??
    deriveApiUrlFromFrontend(baseUrl);

  await assertApiReady(apiUrl);

  cleanupDemoUsers(env);
  insertDemoUsers(env);
  await seedDemoContent(env, secret, apiUrl);

  console.log(`screenshot demo seed complete (user=${SCREENSHOT_DEMO_EMAIL})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
