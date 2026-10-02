import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Search,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { adminApi } from "@/api/admin";
import { getApiErrorMessage } from "@/api/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate, formatVND } from "@/lib/format";
import { firstName } from "@/lib/utils";

const PAGE_SIZE = 20;

export function AdminUsersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "users", search, page],
    queryFn: () => adminApi.users(search || undefined, page, PAGE_SIZE),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <PageHeader
        title="Người dùng"
        subtitle="Tìm kiếm và quản lý tài khoản — xem chi tiết, cấp quyền admin, chặn hoặc đặt lại mật khẩu."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Tìm theo tên hoặc email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <p className="text-sm text-slate-500">
          {data ? `${data.total} người dùng` : "…"}
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
        ) : data && data.users.length === 0 ? (
          <EmptyState
            icon={<Users className="h-7 w-7" />}
            title="Không có kết quả"
            description={
              search
                ? `Không tìm thấy user nào khớp với “${search}”.`
                : "Chưa có user nào trong hệ thống."
            }
          />
        ) : data ? (
          <>
            <Card className="overflow-hidden border-slate-200/80">
              <CardContent className="p-0">
                <ul className="divide-y divide-slate-100">
                  {data.users.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/users/${u.id}`)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage
                            src={u.avatarUrl ?? undefined}
                            alt={u.displayName}
                          />
                          <AvatarFallback>
                            {firstName(u.displayName).toUpperCase().slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium text-slate-900">
                              {u.displayName}
                            </p>
                            {u.isAdmin ? (
                              <Badge variant="success">Admin</Badge>
                            ) : null}
                            {u.isBanned ? (
                              <Badge variant="danger">Chặn</Badge>
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-slate-500">
                            {u.email} · {u.groupCount} nhóm · tạo{" "}
                            {fmtDate(u.createdAt)}
                          </p>
                        </div>
                        <div className="hidden shrink-0 items-center gap-6 text-right sm:flex">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">
                              Chốt
                            </p>
                            <p className="text-sm font-medium tabular-nums text-slate-700">
                              {u.settledDays} ngày
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">
                              Fail
                            </p>
                            <p
                              className={`text-sm font-medium tabular-nums ${
                                u.failedDays > 0
                                  ? "text-rose-600"
                                  : "text-slate-700"
                              }`}
                            >
                              {u.failedDays} ngày
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">
                              Phạt
                            </p>
                            <p
                              className={`text-sm font-semibold tabular-nums ${
                                u.totalPenaltyVnd > 0
                                  ? "text-rose-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {formatVND(u.totalPenaltyVnd)}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
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
