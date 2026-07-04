import { getOAuthLoginUrl, IS_NAVER_LOGIN_ENABLED } from "@/lib/auth";

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
      <p className="text-sm text-zinc-600 dark:text-zinc-400">소셜 계정으로 Echo에 로그인합니다.</p>

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-3">
        <a
          href={getOAuthLoginUrl("google")}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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
    </div>
  );
}
