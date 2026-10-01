import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  UsersRound,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "@/api/admin";
import { getApiErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/format";

const PAGE_SIZE = 20;

export function AdminGroupsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "groups", page],
    queryFn: () => adminApi.groups(page, PAGE_SIZE),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <PageHeader
        title="Nhóm"
        subtitle="Tất cả nhóm trong hệ thống: thành viên, kỳ thử thách và hoạt động."
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={<AlertTriangle className="h-7 w-7" />}
          title="Không tải được danh sách nhóm"
          description={getApiErrorMessage(error)}
          action={
            <Button variant="outline" onClick={() => void refetch()}>
              Thử lại
            </Button>
          }
        />
      ) : data && data.groups.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="h-7 w-7" />}
          title="Chưa có nhóm nào"
          description="Nhóm sẽ xuất hiện ở đây khi user tạo."
        />
      ) : data ? (
        <>
          <Card className="overflow-hidden border-slate-200/80">
            <CardContent className="p-0">
              <ul className="divide-y divide-slate-100">
                {data.groups.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/groups/${g.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                        <UsersRound className="h-5 w-5 text-indigo-500" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900">
                          {g.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          Chủ: {g.ownerName} · tạo {fmtDate(g.createdAt)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium text-slate-700">
                          {g.memberCount} thành viên
                        </p>
                        <p className="text-xs text-slate-400">
                          {g.challengeCount} kỳ thử thách
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

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
  );
}
