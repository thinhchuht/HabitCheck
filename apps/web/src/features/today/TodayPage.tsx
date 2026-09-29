import { Link } from "react-router-dom";
import { CalendarX2, Target } from "lucide-react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { checkinsApi } from "@/api/checkins";
import { getApiErrorMessage } from "@/api/client";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CHALLENGE_STATUS_LABELS } from "@/lib/constants";
import { fmtDayLong, formatVND } from "@/lib/format";
import { useAppStore } from "@/store/app";
import type { TodayItemDto } from "@/types/api";
import { DeadlineCard } from "./DeadlineCard";
import { DurationCard } from "./DurationCard";
import { TodayItemCard } from "./TodayItemCard";
import { WindowCard } from "./WindowCard";

function ItemBody({ item }: { item: TodayItemDto }) {
  switch (item.activity.type) {
    case "DEADLINE":
      return <DeadlineCard item={item} />;
    case "DURATION":
      return <DurationCard item={item} />;
    case "WINDOW":
      return <WindowCard item={item} />;
  }
}

export function TodayPage() {
  const groupId = useAppStore((s) => s.selectedGroupId);
  const setServerOffsetMs = useAppStore((s) => s.setServerOffsetMs);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["today", groupId],
    queryFn: () => checkinsApi.today(groupId!),
    enabled: groupId != null,
  });

  useEffect(() => {
    if (data) setServerOffsetMs(Date.parse(data.serverTime) - Date.now());
  }, [data, setServerOffsetMs]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<CalendarX2 className="h-7 w-7" />}
        title="Không tải được dữ liệu hôm nay"
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

  const passed = data.items.filter((i) => i.state === "PASS").length;
  const total = data.items.length;
  const penalty = data.expectedPenalty;

  return (
    <div>
      <PageHeader
        title={fmtDayLong(data.date)}
        subtitle={
          data.activeChallenge
            ? `Kỳ: "${data.activeChallenge.title}" (${CHALLENGE_STATUS_LABELS[data.activeChallenge.status]})`
            : undefined
        }
      >
        <Badge variant="secondary">
          {passed}/{total} hoạt động
        </Badge>
        <Badge variant={penalty > 0 ? "danger" : "success"}>
          Phạt dự kiến: {formatVND(penalty)}
        </Badge>
      </PageHeader>

      {data.activeChallenge == null ? (
        <EmptyState
          icon={<Target className="h-7 w-7" />}
          title="Chưa có kỳ thử thách nào"
          description="Tạo kỳ thử thách với bảng lịch hoạt động trong ngày (giờ chính xác hoặc thời lượng) để cả nhóm cùng check-in."
          action={
            <Button asChild>
              <Link to="/challenge">Tạo kỳ thử thách</Link>
            </Button>
          }
        />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<Target className="h-7 w-7" />}
          title="Kỳ thử thách chưa có hoạt động"
          description="Thêm hoạt động trong trang Thử thách."
          action={
            <Button asChild>
              <Link to="/challenge">Thêm hoạt động</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.items.map((item) => (
            <TodayItemCard
              key={item.activity.id}
              item={item}
              content={<ItemBody item={item} />}
            />
          ))}
        </div>
      )}
    </div>
  );
}
