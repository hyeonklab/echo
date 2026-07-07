import { getOAuthLoginUrl, IS_NAVER_LOGIN_ENABLED } from "@/lib/auth";
import AppLogo from "@/components/AppLogo";
import ThemeToggle from "@/components/ThemeToggle";

type LoginPanelProps = {
  errorCode?: string | null;
};

/**
 * OAuth 로그인 오류 코드를 사용자 메시지로 변환한다.
 */
export function resolveLoginError(errorCode: string | null | undefined): string | null {
  if (!errorCode) {
    return null;
  }

  if (errorCode === "oauth_failed") {
    return "소셜 로그인에 실패했습니다. 다시 시도해 주세요.";
  }

  return "로그인에 실패했습니다. 다시 시도해 주세요.";
}

/**
 * 앱 셸 우측 패널용 OAuth 로그인 UI.
 */
export default function LoginPanel({ errorCode = null }: Readonly<LoginPanelProps>) {
  const errorMessage = resolveLoginError(errorCode);

  return (
    <div className="mt-6 max-w-md space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="flex flex-col items-center gap-3 pb-1 text-center">
        <AppLogo size={72} href={null} />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">소셜 계정으로 Echo에 로그인합니다.</p>
      </div>

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-3">
        <a
          href={getOAuthLoginUrl("google")}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1A73E8] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#1765CC]"
        >
          Google로 계속하기
        </a>
        {IS_NAVER_LOGIN_ENABLED ? (
          <a
            href={getOAuthLoginUrl("naver")}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#03C75A] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#02b351]"
          >
            Naver로 계속하기
          </a>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">테마</span>
        <ThemeToggle />
      </div>
    </div>
  );
}
