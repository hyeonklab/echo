import LoginPanel from "@/components/LoginPanel";

type ShellLoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

/**
 * 앱 셸 우측 로그인 패널.
 */
export default async function ShellLoginPage({ searchParams }: Readonly<ShellLoginPageProps>) {
  const params = await searchParams;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">Echo</p>
        <h1 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">로그인</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <LoginPanel errorCode={params.error ?? null} />
      </div>
    </div>
  );
}
