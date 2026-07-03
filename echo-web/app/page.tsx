import HomeAuth from "@/components/HomeAuth";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Echo</p>
        <h1 className="mt-3 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          실시간 메신저
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Google 또는 Naver 계정으로 로그인하고 실시간 채팅을 시작하세요.
        </p>
        <HomeAuth />
      </div>
    </main>
  );
}
