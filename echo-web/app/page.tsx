import { redirect } from "next/navigation";

/**
 * 루트 경로는 앱 셸 홈으로 이동한다.
 */
export default function Home() {
  redirect("/home");
}
