import {
  AlertTriangle,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListChecks,
  Search,
  User,
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
import type {
  AdminActivity,
  AdminChallenge,
  ChallengeStatus,
} from "@/types/api";

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

function ActivityIcon({ icon }: { icon: string | null }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-base">
      {icon && isEmojiLike(icon) ? (
        icon
      ) : (
        <Clock className="h-4 w-4 text-slate-500" />
      )}
    </span>
  );
}

function ActivitiesTable({ activities }: { activities: AdminActivity[] }) {
  return (
    <Card className="overflow-hidden border-slate-200/80">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 font-medium">Hoạt động</th>
                <th className="px-4 py-2.5 font-medium">Kiểu</th>
                <th className="px-4 py-2.5 font-medium">Bằng chứng</th>
                <th className="px-4 py-2.5 text-right font-medium">Check-in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activities.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ActivityIcon icon={a.icon} />
                      <p className="font-medium text-slate-900">{a.name}</p>
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
  );
}

/** Cấp 2: hoạt động của một kỳ thử thách cụ thể. */
function ChallengeDetail({
  challenge,
  onBack,
}: {
  challenge: AdminChallenge;
  onBack: () => void;
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "challenge-activities", challenge.id, page],
    queryFn: () =>
      adminApi.activities(undefined, undefined, page, PAGE_SIZE, challenge.id),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <Button variant="outline" size="sm" onClick={onBack}>
        <ChevronLeft className="h-4 w-4" /> Danh sách kỳ
      </Button>

      <Card className="mt-4 border-slate-200/80">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div>
              <div className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-indigo-500" />
                <h2 className="text-base font-semibold text-slate-900">
                  {challenge.title}
                </h2>
                <Badge variant={CHALLENGE_STATUS_VARIANT[challenge.status]}>
                  {CHALLENGE_STATUS_LABELS[challenge.status]}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {fmtDate(challenge.startDate)} → {fmtDate(challenge.endDate)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <ListChecks className="h-4 w-4 text-slate-400" />
              {challenge.activityCount} hoạt động
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <Clock className="h-4 w-4 text-slate-400" />
              {challenge.checkinCount} check-in
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <User className="h-4 w-4 text-slate-400" />
              {challenge.ownerName} · {challenge.groupName}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={<AlertTriangle className="h-7 w-7" />}
            title="Không tải được hoạt động"
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
            title="Kỳ này chưa có hoạt động"
            description="Người tạo kỳ chưa định nghĩa hoạt động nào."
          />
        ) : data ? (
          <>
            <ActivitiesTable activities={data.activities} />

            {totalPages > 1 ? (
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
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

export function AdminActivitiesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | ChallengeStatus>("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminChallenge | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "challenges", search, status, page],
    queryFn: () =>
      adminApi.challenges(
        search || undefined,
        status === "ALL" ? undefined : status,
        page,
        PAGE_SIZE,
      ),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  if (selected) {
    return (
      <ChallengeDetail challenge={selected} onBack={() => setSelected(null)} />
    );
  }

  return (
    <div>
      <PageHeader
        title="Kỳ thử thách"
        subtitle="Toàn bộ kỳ trong mọi nhóm — bấm vào một kỳ để xem hoạt động do người tạo kỳ đó định nghĩa."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Tìm theo tên kỳ, nhóm hoặc người tạo…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "ALL" | ChallengeStatus);
            setPage(1);
          }}
        >
          <option value="ALL">Mọi trạng thái</option>
          <option value="DRAFT">{CHALLENGE_STATUS_LABELS.DRAFT}</option>
          <option value="ACTIVE">{CHALLENGE_STATUS_LABELS.ACTIVE}</option>
          <option value="COMPLETED">{CHALLENGE_STATUS_LABELS.COMPLETED}</option>
          <option value="CANCELLED">{CHALLENGE_STATUS_LABELS.CANCELLED}</option>
        </select>
        <p className="text-sm text-slate-500">
          {data ? `${data.total} kỳ` : "…"}
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
        ) : data && data.challenges.length === 0 ? (
          <EmptyState
            icon={<CalendarRange className="h-7 w-7" />}
            title="Không có kết quả"
            description={
              search
                ? `Không tìm thấy kỳ nào khớp với “${search}”.`
                : "Chưa có kỳ thử thách nào trong hệ thống."
            }
          />
        ) : data ? (
          <>
            <Card className="overflow-hidden border-slate-200/80">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-2.5 font-medium">
                          Kỳ thử thách
                        </th>
                        <th className="px-4 py-2.5 font-medium">Nhóm</th>
                        <th className="px-4 py-2.5 font-medium">Người tạo</th>
                        <th className="px-4 py-2.5 text-right font-medium">
                          Hoạt động
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium">
                          Check-in
                        </th>
                        <th className="px-2 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.challenges.map((c) => (
                        <tr
                          key={c.id}
                          className="cursor-pointer hover:bg-slate-50"
                          onClick={() => setSelected(c)}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">
                              {c.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              {fmtDate(c.startDate)} → {fmtDate(c.endDate)}
                            </p>
                            <Badge variant={CHALLENGE_STATUS_VARIANT[c.status]}>
                              {CHALLENGE_STATUS_LABELS[c.status]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-800">
                            {c.groupName}
                          </td>
                          <td className="px-4 py-3 text-slate-800">
                            {c.ownerName}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {c.activityCount}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {c.checkinCount}
                          </td>
                          <td className="px-2 py-3 text-right">
                            <ChevronRight className="h-4 w-4 text-slate-300" />
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
