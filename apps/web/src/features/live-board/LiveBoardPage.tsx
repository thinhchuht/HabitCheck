import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { groupsApi } from "@/api/groups";
import { getApiErrorMessage } from "@/api/client";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDayLong, formatVND } from "@/lib/format";
import { useAppStore } from "@/store/app";
import { useAuthStore } from "@/store/auth";
import { MemberCard } from "./MemberCard";
import { Ticker } from "./Ticker";

export function LiveBoardPage() {
  const groupId = useAppStore((s) => s.selectedGroupId);
  const setServerOffsetMs = useAppStore((s) => s.setServerOffsetMs);
  const meUserId = useAuthStore((s) => s.user?.id ?? null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["live", groupId],
    queryFn: () =>
      groupId
        ? groupsApi.live(groupId)
        : Promise.reject(new Error("Chưa chọn nhóm")),
    enabled: groupId != null,
  });

  useEffect(() => {
    if (data) setServerOffsetMs(Date.parse(data.serverTime) - Date.now());
  }, [data, setServerOffsetMs]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<Users className="h-7 w-7" />}
        title="Không tải được bảng live"
        description={getApiErrorMessage(error)}
        action={
          <button
            type="button"
            className="text-sm font-medium text-indigo-600 hover:underline"
            onClick={() => void refetch()}
          >
            Thử lại
          </button>
        }
      />
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5">
      <PageHeader title="Bảng live nhóm" subtitle={fmtDayLong(data.date)}>
        <Badge variant={data.totalExpectedPenalty > 0 ? "danger" : "success"}>
          Tổng phạt dự kiến: {formatVND(data.totalExpectedPenalty)}
        </Badge>
      </PageHeader>

      <Ticker items={data.ticker} />

      <div className="grid gap-4 md:grid-cols-2">
        {data.members.map((m) => (
          <MemberCard key={m.userId} member={m} meUserId={meUserId} />
        ))}
      </div>
    </div>
  );
}
