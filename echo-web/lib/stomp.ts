/**
 * STOMP 클라이언트 연동용 유틸 (구현 예정).
 */
export const STOMP_BROKER_URL =
  process.env.NEXT_PUBLIC_STOMP_URL ?? "http://localhost:8080/ws";
