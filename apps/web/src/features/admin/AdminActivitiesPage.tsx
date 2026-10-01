import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListChecks,
  Search,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { getApiErrorMessage } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ACTIVITY_TYPE_LABELS,
  CHALLENGE_STATUS_LABELS,
  PROOF_TYPE_LABELS,
} from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { isEmojiLike } from "@/lib/utils";
import type { ActivityType, ChallengeStatus } from "@/types/api";

const PAGE_SIZE = 20;

const CHALLENGE_STATUS_VARIANT: Record<
  ChallengeStatus,
  "secondary" | "success" | "outline" | "danger"
> = {
  DRAFT: "secondary",
  ACTIVE: "success",
  COMPLETED: "outline",
  CANCELLED: "danger",
};

export function AdminActivitiesPage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"ALL" | ActivityType>("ALL");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "activities", search, type, page],
    queryFn: () =>
      adminApi.activities(
        search || undefined,
        type === "ALL" ? undefined : type,
        page,
        PAGE_SIZE,
      ),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <PageHeader
        title="Hoạt động"
        subtitle="Toàn bộ hoạt động trong mọi kỳ thử thách, kèm số lần check-in."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Tìm theo tên hoạt động hoặc kỳ…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={type}
          onChange={(e) => {
            setType(e.target.value as "ALL" | ActivityType);
            setPage(1);
          }}
        >
          <option value="ALL">Mọi kiểu</option>
          <option value="DEADLINE">{ACTIVITY_TYPE_LABELS.DEADLINE}</option>
          <option value="DURATION">{ACTIVITY_TYPE_LABELS.DURATION}</option>
          <option value="WINDOW">{ACTIVITY_TYPE_LABELS.WINDOW}</option>
        </select>
        <p className="text-sm text-slate-500">
          {data ? `${data.total} hoạt động` : "…"}
        </p>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={<AlertTriangle className="h-7 w-7" />}
            title="Không tải được danh sách"
            description={getApiErrorMessage(error)}
            action={
              <Button variant="outline" onClick={() => void refetch()}>
                Thử lại
              </Button>
            }
          />
        ) : data && data.activities.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="h-7 w-7" />}
            title="Không có kết quả"
            description={
              search
                ? `Không tìm thấy hoạt động nào khớp với “${search}”.`
                : "Chưa có hoạt động nào trong hệ thống."
            }
          />
        ) : data ? (
          <>
            <Card className="overflow-hidden border-slate-200/80">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-2.5 font-medium">Hoạt động</th>
                        <th className="px-4 py-2.5 font-medium">Kiểu</th>
                        <th className="px-4 py-2.5 font-medium">Bằng chứng</th>
                        <th className="px-4 py-2.5 font-medium">
                          Kỳ thử thách
                        </th>
                        <th className="px-4 py-2.5 font-medium">Nhóm / Chủ</th>
                        <th className="px-4 py-2.5 text-right font-medium">
                          Check-in
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.activities.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-base">
                                {a.icon && isEmojiLike(a.icon) ? (
                                  a.icon
                                ) : (
                                  <Clock className="h-4 w-4 text-slate-500" />
                                )}
                              </span>
                              <p className="font-medium text-slate-900">
                                {a.name}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary">
                              {ACTIVITY_TYPE_LABELS[a.type]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">
                              {PROOF_TYPE_LABELS[a.proofType]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">
                              {a.challengeTitle}
                            </p>
                            <p className="text-xs text-slate-500">
                              {fmtDate(a.startDate)} → {fmtDate(a.endDate)}
                            </p>
                            <Badge
                              variant={
                                CHALLENGE_STATUS_VARIANT[a.challengeStatus]
                              }
                            >
                              {CHALLENGE_STATUS_LABELS[a.challengeStatus]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-slate-800">{a.groupName}</p>
                            <p className="text-xs text-slate-500">
                              {a.ownerName}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {a.checkinCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="mt-3 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Trước
              </Button>
              <p className="text-sm text-slate-500">
                Trang {page} / {totalPages}
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
