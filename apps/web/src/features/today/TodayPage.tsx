import { Link } from "react-router-dom";
import { CalendarX2, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { checkinsApi } from "@/api/checkins";
import { getApiErrorMessage } from "@/api/client";
import { meApi } from "@/api/me";
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
  const queryClient = useQueryClient();
  const [marking, setMarking] = useState(false);

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

  const isCheatToday = data.cheatDay === data.date;
  const canMarkCheat =
    data.activeChallenge != null &&
    !isCheatToday &&
    data.cheatDaysThisWeek.length === 0;

  async function handleMarkCheat() {
    if (groupId == null || marking) return;
    setMarking(true);
    try {
      await meApi.markCheatDay(groupId);
      toast.success("Đã đánh dấu cheat day cho hôm nay 🎉");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["today", groupId] }),
        queryClient.invalidateQueries({ queryKey: ["live", groupId] }),
      ]);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setMarking(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Hôm nay"
        subtitle={
          data.activeChallenge
            ? `${fmtDayLong(data.date)} · Kỳ "${data.activeChallenge.title}" (${CHALLENGE_STATUS_LABELS[data.activeChallenge.status]})`
            : fmtDayLong(data.date)
        }
      >
        <Badge variant="secondary">
          {passed}/{total} hoạt động
        </Badge>
        <Badge variant={penalty > 0 ? "danger" : "success"}>
          Phạt dự kiến: {formatVND(penalty)}
        </Badge>
        {canMarkCheat ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={marking}
            onClick={() => void handleMarkCheat()}
          >
            {marking ? "Đang đánh dấu…" : "🎉 Cheat day hôm nay"}
          </Button>
        ) : null}
      </PageHeader>

      {isCheatToday ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="font-semibold text-emerald-800">
              Hôm nay là Cheat Day của bạn!
            </p>
            <p className="text-sm text-emerald-700">
              Không cần check-in, không tính phạt — coi như một ngày nghỉ trong
              kế hoạch. Mỗi tuần chỉ có 1 cheat day trong nhóm này nhé.
            </p>
          </div>
        </div>
      ) : null}

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
