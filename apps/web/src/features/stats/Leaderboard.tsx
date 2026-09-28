import { useQuery } from "@tanstack/react-query";
import { statsApi } from "@/api/stats";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatVND } from "@/lib/format";
import { cn, firstName } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

const MEDALS = ["🥇", "🥈", "🥉"];

interface LeaderboardProps {
  groupId: string;
  from: string;
  to: string;
}

export function Leaderboard({ groupId, from, to }: LeaderboardProps) {
  const meUserId = useAuthStore((s) => s.user?.id ?? null);

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", groupId, from, to],
    queryFn: () => statsApi.leaderboard(groupId, { from, to }),
    enabled: groupId != null,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-slate-400">
          Chưa có dữ liệu xếp hạng trong khoảng này.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        {data.map((row) => (
          <div
            key={row.userId}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3",
              row.userId === meUserId && "border-indigo-200 bg-indigo-50/60"
            )}
          >
            <span className="w-8 text-center text-lg">
              {row.rank <= 3 ? MEDALS[row.rank - 1] : `#${row.rank}`}
            </span>
            <Avatar className="h-10 w-10">
              {row.avatarUrl ? (
                <AvatarImage src={row.avatarUrl} alt={row.displayName} />
              ) : null}
              <AvatarFallback>
                {firstName(row.displayName).toUpperCase().slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate font-semibold text-slate-900">{row.displayName}</p>
                {row.userId === meUserId ? <Badge variant="outline">Bạn</Badge> : null}
              </div>
              <p className="text-xs text-slate-400">
                {row.passedActivities}/{row.totalActivities} hoạt động đạt
              </p>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-indigo-600">
                {Math.round(row.completionRate * 100)}%
              </p>
              <p className="text-xs text-slate-400">hoàn thành</p>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-rose-600">
                {formatVND(row.totalPenalty)}
              </p>
              <p className="text-xs text-slate-400">phạt</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">{row.currentStreak}</p>
              <p className="text-xs text-slate-400">streak</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
