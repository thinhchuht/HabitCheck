import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  KeyRound,
  Pencil,
  Shield,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
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
import { Input } from "@/components/ui/input";
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
  const [renameValue, setRenameValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");

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

  async function toggleBan() {
    if (!id) return;
    if (!u.isBanned && !window.confirm(`Chặn tài khoản ${u.displayName}?`))
      return;
    setBusy(true);
    try {
      if (u.isBanned) {
        await adminApi.unban(id);
        toast.success("Đã bỏ chặn tài khoản.");
      } else {
        await adminApi.ban(id);
        toast.success("Đã chặn tài khoản.");
      }
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Thao tác thất bại"));
    } finally {
      setBusy(false);
    }
  }

  async function saveRename(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error("Tên hiển thị không được để trống.");
      return;
    }
    setBusy(true);
    try {
      await adminApi.rename(id, name);
      toast.success("Đã đổi tên hiển thị.");
      setRenameValue("");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Đổi tên thất bại"));
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (passwordValue.length < 8) {
      toast.error("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }
    setBusy(true);
    try {
      await adminApi.setPassword(id, passwordValue);
      toast.success("Đã đặt lại mật khẩu.");
      setPasswordValue("");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Đặt mật khẩu thất bại"));
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
      <PageHeader
        title={u.displayName}
        subtitle={`Tạo ngày ${fmtDate(u.createdAt)} · Tham gia ${u.groupCount} nhóm`}
      />

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
                  {u.isBanned ? (
                    <Badge variant="danger">
                      <Ban className="mr-1 h-3 w-3" />
                      Chặn
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

            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                Tài khoản
              </p>
              <div className="space-y-3">
                {u.isBanned ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void toggleBan()}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Bỏ chặn
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy || isSelf}
                    title={
                      isSelf
                        ? "Không thể tự chặn tài khoản của chính mình"
                        : undefined
                    }
                    onClick={() => void toggleBan()}
                  >
                    <Ban className="h-4 w-4" />
                    Chặn user
                  </Button>
                )}

                <form
                  onSubmit={(e) => void saveRename(e)}
                  className="space-y-1.5"
                >
                  <p className="text-xs font-medium text-slate-500">
                    Đổi tên hiển thị
                  </p>
                  <div className="flex gap-2">
                    <Input
                      className="flex-1"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      placeholder="Tên hiển thị mới"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={busy || renameValue.trim().length === 0}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </form>

                {u.username ? (
                  <form
                    onSubmit={(e) => void savePassword(e)}
                    className="space-y-1.5"
                  >
                    <p className="text-xs font-medium text-slate-500">
                      Đặt lại mật khẩu @{u.username}
                    </p>
                    <div className="flex gap-2">
                      <Input
                        className="flex-1"
                        type="password"
                        value={passwordValue}
                        onChange={(e) => setPasswordValue(e.target.value)}
                        placeholder="Mật khẩu mới (≥ 8 ký tự)"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={busy || passwordValue.length < 8}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className="text-xs text-slate-400">
                    User đăng nhập bằng Google — không có mật khẩu.
                  </p>
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
