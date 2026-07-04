import { getOnlineStatusLabel } from "@/lib/presence";

type OnlineStatusDotProps = {
  online: boolean;
  showLabel?: boolean;
};

/**
 * 사용자 온라인 상태 표시 점.
 */
export default function OnlineStatusDot({ online, showLabel = false }: OnlineStatusDotProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
          online ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"
        }`}
        aria-hidden="true"
      />
      {showLabel ? (
        <span className={`text-xs ${online ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}`}>
          {getOnlineStatusLabel(online)}
        </span>
      ) : (
        <span className="sr-only">{getOnlineStatusLabel(online)}</span>
      )}
    </span>
  );
}
