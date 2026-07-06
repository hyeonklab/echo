# echo-web/scripts

README 스크린샷 재생성용. 앱 실행 필수. 일반 개발 시 불필요.

## 실행

PostgreSQL·백엔드·프론트가 떠 있고, Echo 루트 `.env`의 `JWT_SECRET`·`FRONTEND_URL`이 캡처 URL과 맞아야 합니다.

```bash
cd echo-web
npm run screenshots:install   # 최초 1회 (Playwright Chromium)
npm run screenshots           # 더미 시드 + PNG 캡처
```

결과물은 `Echo/docs/screenshots/`에 저장됩니다.

## 스크립트

| 파일 | 역할 |
|------|------|
| `screenshot-demo-data.mjs` | 더미 사용자·대화·이미지 URL 정의 |
| `seed-screenshot-demo.mjs` | DB 시드 및 API로 채팅방·메시지 생성 |
| `readme-screenshot-auth.mjs` | 데모 계정 JWT 발급, base URL 해석 |
| `capture-readme-screenshots.mjs` | Playwright로 화면 캡처 |
