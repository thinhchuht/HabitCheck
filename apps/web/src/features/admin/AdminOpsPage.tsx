import {
  AlertTriangle,
  Bell,
  ChevronLeft,
  ChevronRight,
  History,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "@/api/admin";
import { getApiErrorMessage } from "@/api/client";
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
import { fmtDateTime, vnNow } from "@/lib/format";

const AUDIT_PAGE_SIZE = 30;

const ACTION_LABELS: Record<string, string> = {
  BAN: "Chặn user",
  UNBAN: "Bỏ chặn",
  RENAME: "Đổi tên",
  SET_PASSWORD: "Đổi mật khẩu",
  GRANT_ADMIN: "Cấp admin",
  REVOKE_ADMIN: "Thu hồi admin",
  SETTLE: "Chốt ngày",
  FINALIZE: "Finalize",
  ACTIVATE: "Kích hoạt kỳ",
  ANNOUNCE: "Thông báo",
};

const ACTION_VARIANT: Record<string, "secondary" | "success" | "danger"> = {
  BAN: "danger",
  UNBAN: "success",
  ANNOUNCE: "success",
};

export function AdminOpsPage() {
  const queryClient = useQueryClient();

  const [date, setDate] = useState(vnNow().format("YYYY-MM-DD"));
  const [running, setRunning] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [logPage, setLogPage] = useState(1);

  const jobsQuery = useQuery({
    queryKey: ["admin", "jobs"],
    queryFn: () => adminApi.jobs(),
  });

  const logsQuery = useQuery({
    queryKey: ["admin", "audit-logs", logPage],
    queryFn: () => adminApi.auditLogs(logPage, AUDIT_PAGE_SIZE),
  });

  const logTotalPages = logsQuery.data
    ? Math.max(
        1,
        Math.ceil(logsQuery.data.total / AUDIT_PAGE_SIZE),
      )
    : 1;

  async function runJob(kind: "settle" | "finalize" | "activate", label: string) {
    setRunning(kind);
    try {
      const res =
        kind === "settle"
          ? await adminApi.settle(date)
          : kind === "finalize"
            ? await adminApi.finalize(date)
            : await adminApi.activate();
      toast.success(`${label}: ${JSON.stringify(res)}`);
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, `${label} thất bại`));
    } finally {
      setRunning(null);
    }
  }

  async function sendAnnouncement(e: FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (text.length === 0) {
      toast.error("Nhập nội dung thông báo trước.");
      return;
    }
    setSending(true);
    try {
      const res = await adminApi.announce(text);
      toast.success(`Đã gửi thông báo tới ${res.senderName ? "mọi người" : "…"}`);
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Gửi thông báo thất bại"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Vận hành"
        subtitle="Trạng thái job định kỳ, chạy lại job, gửi thông báo và lịch sử thao tác admin."
      />

      <Card className="border-slate-200/80">
        <CardHeader>
          <CardTitle className="text-base">Job định kỳ (Hangfire)</CardTitle>
          <CardDescription>
            Lịch chạy theo múi giờ Asia/Ho_Chi_Minh. Giờ hiển thị là giờ VN.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {jobsQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : jobsQuery.isError ? (
            <div className="p-4">
              <p className="text-sm text-slate-500">
                {getApiErrorMessage(jobsQuery.error)}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void jobsQuery.refetch()}
              >
                Thử lại
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 font-medium">Job</th>
                    <th className="px-4 py-2.5 font-medium">Cron</th>
                    <th className="px-4 py-2.5 font-medium">Chức năng</th>
                    <th className="px-4 py-2.5 font-medium">Chạy tới</th>
                    <th className="px-4 py-2.5 font-medium">Chạy gần nhất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(jobsQuery.data ?? []).map((j) => (
                    <tr key={j.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{j.name}</p>
                        <p className="font-mono text-xs text-slate-400">
                          {j.id}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                          {j.cron}
                        </code>
                      </td>
                      <td className="max-w-[280px] px-4 py-3 text-slate-500">
                        {j.description}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {j.nextExecutionUtc ? (
                          fmtDateTime(j.nextExecutionUtc)
                        ) : (
                          <span className="text-slate-400">chưa lên lịch</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {j.lastExecutionUtc ? (
                          fmtDateTime(j.lastExecutionUtc)
                        ) : (
                          <span className="text-slate-400">chưa chạy</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4 border-slate-200/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlayCircle className="h-5 w-5 text-indigo-500" />
            Chạy lại job (chỉ môi trường Development)
          </CardTitle>
          <CardDescription>
            Chạy lại job idempotent cho 1 ngày cụ thể — dùng khi job định kỳ
            trượt hoặc cần tính lại sau khi từ chối bằng chứng.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
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
              onClick={() => void runJob("settle", "Chốt ngày")}
            >
              {running === "settle" ? "Đang chạy…" : "Chốt ngày (PROVISIONAL)"}
            </Button>
            <Button
              variant="outline"
              disabled={running != null}
              onClick={() => void runJob("finalize", "Finalize")}
            >
              {running === "finalize"
                ? "Đang chạy…"
                : "Finalize (FINAL)"}
            </Button>
            <Button
              variant="outline"
              disabled={running != null}
              onClick={() => void runJob("activate", "Kích hoạt")}
            >
              {running === "activate" ? "Đang chạy…" : "Kích hoạt kỳ mới"}
            </Button>
          </div>
          <p className="text-xs text-slate-400">
            “Chốt ngày” tính kết quả tạm thời, “Finalize” chốt FINAL + ghi sổ
            quỹ, “Kích hoạt kỳ mới” chuyển DRAFT có ngày bắt đầu hôm nay sang
            ACTIVE.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4 border-slate-200/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5 text-indigo-500" />
            Gửi thông báo tới tất cả user online
          </CardTitle>
          <CardDescription>
            Push qua SignalR — mọi client đang mở sẽ thấy toast thông báo ngay.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void sendAnnouncement(e)} className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                className="flex-1"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Nội dung thông báo (tối đa 500 ký tự)"
                maxLength={500}
              />
              <Button type="submit" disabled={sending}>
                {sending ? "Đang gửi…" : "Gửi thông báo"}
              </Button>
            </div>
            <p className="text-right text-xs text-slate-400">
              {message.trim().length}/500
            </p>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-4 border-slate-200/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5 text-indigo-500" />
            Lịch sử thao tác admin
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logsQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : logsQuery.isError ? (
            <div className="p-4">
              <p className="text-sm text-slate-500">
                {getApiErrorMessage(logsQuery.error)}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void logsQuery.refetch()}
              >
                Thử lại
              </Button>
            </div>
          ) : logsQuery.data && logsQuery.data.logs.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="h-7 w-7" />}
              title="Chưa có thao tác nào"
              description="Các thao tác quản lý (chặn user, đổi tên, gửi thông báo…) sẽ được ghi ở đây."
            />
          ) : logsQuery.data ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2.5 font-medium">Thời gian</th>
                      <th className="px-4 py-2.5 font-medium">Admin</th>
                      <th className="px-4 py-2.5 font-medium">Thao tác</th>
                      <th className="px-4 py-2.5 font-medium">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logsQuery.data.logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                          {fmtDateTime(log.createdAt)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-800">
                          {log.adminName}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant={ACTION_VARIANT[log.action] ?? "secondary"}
                          >
                            {ACTION_LABELS[log.action] ?? log.action}
                          </Badge>
                        </td>
                        <td className="max-w-[380px] truncate px-4 py-2.5 text-slate-500">
                          {log.detail ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={logPage <= 1}
                  onClick={() => setLogPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Trước
                </Button>
                <p className="text-sm text-slate-500">
                  Trang {logPage} / {logTotalPages}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={logPage >= logTotalPages}
                  onClick={() => setLogPage((p) => p + 1)}
                >
                  Sau
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
        <RefreshCw className="h-3.5 w-3.5" />
        Trạng thái job đọc trực tiếp từ lưu trữ Hangfire (Postgres) — giá trị
        NextExecution do scheduler tính sẵn.
      </p>
    </div>
  );
}
