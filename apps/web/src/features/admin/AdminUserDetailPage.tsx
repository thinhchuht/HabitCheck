import { AlertTriangle, ArrowLeft, Shield, ShieldOff } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link, useParams } from "react-router-dom";
import { adminApi } from "@/api/admin";
import { getApiErrorMessage } from "@/api/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate, fmtDateTime, formatVND } from "@/lib/format";
import { firstName } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { ChallengeStatsCard } from "@/features/admin/ChallengeStatsCard";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Chủ nhóm",
  ADMIN: "Quản trị",
  MEMBER: "Thành viên",
};

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "user", id],
    queryFn: () => adminApi.user(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-7 w-7" />}
        title="Không tải được thông tin user"
        description={getApiErrorMessage(error)}
        action={
          <Button variant="outline" onClick={() => void refetch()}>
            Thử lại
          </Button>
        }
      />
    );
  }

  async function setAdmin(makeAdmin: boolean) {
    if (!id) return;
    setBusy(true);
    try {
      await (makeAdmin ? adminApi.makeAdmin(id) : adminApi.revokeAdmin(id));
      toast.success(
        makeAdmin ? "Đã cấp quyền Admin." : "Đã thu hồi quyền Admin.",
      );
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Thao tác thất bại"));
    } finally {
      setBusy(false);
    }
  }

  const u = data.user;
  const isSelf = me?.id === u.id;

  return (
    <div>
      <Link
        to="/admin/users"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Danh sách user
      </Link>
      <PageHeader title={u.displayName} subtitle={u.email} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200/80 lg:col-span-1">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage
                  src={u.avatarUrl ?? undefined}
                  alt={u.displayName}
                />
                <AvatarFallback className="text-xl">
                  {firstName(u.displayName).toUpperCase().slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-bold text-slate-900">
                    {u.displayName}
                  </p>
                  {u.isAdmin ? (
                    <Badge variant="success">
                      <Shield className="mr-1 h-3 w-3" />
                      Admin
                    </Badge>
                  ) : null}
                </div>
                <p className="truncate text-sm text-slate-500">{u.email}</p>
                {u.username ? (
                  <p className="truncate text-xs text-slate-400">
                    @{u.username}
                  </p>
                ) : null}
              </div>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Tạo tài khoản</dt>
                <dd className="font-medium text-slate-800">
                  {fmtDate(u.createdAt)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Đăng nhập gần nhất</dt>
                <dd className="font-medium text-slate-800">
                  {u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Số nhóm</dt>
                <dd className="font-medium text-slate-800">{u.groupCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Ngày đã chốt</dt>
                <dd className="font-medium text-slate-800">{u.settledDays}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Ngày fail</dt>
                <dd
                  className={`font-medium ${u.failedDays > 0 ? "text-rose-600" : "text-slate-800"}`}
                >
                  {u.failedDays}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Tổng phạt</dt>
                <dd
                  className={`font-bold ${u.totalPenaltyVnd > 0 ? "text-rose-600" : "text-emerald-600"}`}
                >
                  {formatVND(u.totalPenaltyVnd)}
                </dd>
              </div>
            </dl>

            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                Quyền quản trị
              </p>
              <div className="flex gap-2">
                {!u.isAdmin ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void setAdmin(true)}
                  >
                    <Shield className="h-4 w-4" />
                    Cấp quyền Admin
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || isSelf}
                    title={
                      isSelf
                        ? "Không thể tự thu hồi quyền của chính mình"
                        : undefined
                    }
                    onClick={() => void setAdmin(false)}
                  >
                    <ShieldOff className="h-4 w-4" />
                    Thu hồi Admin
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {data.groups.length === 0 ? (
            <Card className="border-slate-200/80">
              <CardContent className="p-6">
                <p className="text-sm text-slate-500">
                  User này chưa tham gia nhóm nào.
                </p>
              </CardContent>
            </Card>
          ) : (
            data.groups.map((g) => (
              <Card key={g.groupId} className="border-slate-200/80">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{g.groupName}</CardTitle>
                    <Badge variant="secondary">
                      {ROLE_LABELS[g.role] ?? g.role}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      Chủ nhóm: {g.ownerName}
                    </span>
                  </div>
                  <CardDescription>
                    {g.challenges.length} kỳ thử thách
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {g.challenges.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      Chưa có kỳ thử thách nào.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {g.challenges.map((item) => (
                        <ChallengeStatsCard
                          key={item.challenge.id}
                          item={item}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
