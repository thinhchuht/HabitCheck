import {
  AlertTriangle,
  CalendarCheck,
  PlayCircle,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "@/api/admin";
import { getApiErrorMessage } from "@/api/client";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate, fmtDateTime, formatVND, vnNow } from "@/lib/format";
import type { ComponentType } from "react";

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "default" | "danger" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "text-rose-600"
      : tone === "success"
        ? "text-emerald-600"
        : "text-slate-900";
  return (
    <Card className="border-slate-200/80">
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
          <Icon className="h-5 w-5 text-indigo-500" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs text-slate-500">{label}</p>
          <p className={`truncate text-lg font-bold tabular-nums ${toneClass}`}>
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Nút chạy job (settle / finalize / activate) cho 1 ngày — chỉ server Development. */
function OpsCard() {
  const [date, setDate] = useState(vnNow().format("YYYY-MM-dd"));
  const [running, setRunning] = useState<string | null>(null);

  async function run(kind: "settle" | "finalize" | "activate", label: string) {
    setRunning(kind);
    try {
      const res =
        kind === "settle"
          ? await adminApi.settle(date)
          : kind === "finalize"
            ? await adminApi.finalize(date)
            : await adminApi.activate();
      toast.success(`${label}: ${JSON.stringify(res)}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, `${label} thất bại`));
    } finally {
      setRunning(null);
    }
  }

  return (
    <Card className="border-slate-200/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PlayCircle className="h-5 w-5 text-indigo-500" />
          Vận hành job (chỉ môi trường Development)
        </CardTitle>
        <CardDescription>
          Chạy lại job idempotent cho 1 ngày cụ thể — dùng khi job định kỳ trượt
          hoặc cần tính lại sau khi từ chối bằng chứng.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-2">
          <div className="w-44 space-y-1.5">
            <p className="text-xs font-medium text-slate-500">Ngày</p>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            disabled={running != null}
            onClick={() => void run("settle", "Chốt ngày")}
          >
            {running === "settle" ? "Đang chạy…" : "Chốt ngày (PROVISIONAL)"}
          </Button>
          <Button
            variant="outline"
            disabled={running != null}
            onClick={() => void run("finalize", "Finalize")}
          >
            {running === "finalize" ? "Đang chạy…" : "Finalize (FINAL)"}
          </Button>
          <Button
            variant="outline"
            disabled={running != null}
            onClick={() => void run("activate", "Kích hoạt")}
          >
            {running === "activate" ? "Đang chạy…" : "Kích hoạt kỳ mới"}
          </Button>
        </div>
        <p className="text-xs text-slate-400">
          “Chốt ngày” tính kết quả tạm thời, “Finalize” chốt FINAL + ghi sổ quỹ,
          “Kích hoạt kỳ mới” chuyển DRAFT có ngày bắt đầu hôm nay sang ACTIVE.
        </p>
      </CardContent>
    </Card>
  );
}

export function AdminDashboardPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => adminApi.stats(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-7 w-7" />}
        title="Không tải được thống kê"
        description={getApiErrorMessage(error)}
        action={
          <Button variant="outline" onClick={() => void refetch()}>
            Thử lại
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Quản trị"
        subtitle="Tổng quan hệ thống: người dùng, nhóm, kỳ thử thách và quỹ phạt."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={Users}
          label="Tổng user"
          value={String(data.totalUsers)}
        />
        <StatCard
          icon={UsersRound}
          label="Tổng nhóm"
          value={String(data.totalGroups)}
        />
        <StatCard
          icon={CalendarCheck}
          label="Kỳ đang diễn ra / dự thảo"
          value={`${data.activeChallenges} / ${data.draftChallenges}`}
        />
        <StatCard
          icon={CalendarCheck}
          label="Check-in hôm nay"
          value={String(data.checkinsToday)}
        />
        <StatCard
          icon={Wallet}
          label="Phạt hôm nay"
          value={formatVND(data.penaltyTodayVnd)}
          tone={data.penaltyTodayVnd > 0 ? "danger" : "success"}
        />
        <StatCard
          icon={Wallet}
          label="Tổng phạt (đã chốt)"
          value={formatVND(data.penaltyTotalVnd)}
          tone={data.penaltyTotalVnd > 0 ? "danger" : "success"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="border-slate-200/80 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Người dùng mới nhất</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentUsers.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có user nào.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.recentUsers.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-slate-900">
                          {u.displayName}
                        </p>
                        {u.isAdmin ? (
                          <Badge variant="success">Admin</Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        {u.email} · {u.groupCount} nhóm · tạo{" "}
                        {fmtDate(u.createdAt)}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-slate-400">
                      {u.lastLoginAt
                        ? `đăng nhập ${fmtDateTime(u.lastLoginAt)}`
                        : "chưa quay lại"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <OpsCard />
        </div>
      </div>
    </div>
  );
}
