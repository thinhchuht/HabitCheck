import { AlertTriangle, CircleDollarSign, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { getApiErrorMessage } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { LEDGER_KIND_LABELS } from "@/lib/constants";
import { fmtDateTime, formatVND } from "@/lib/format";
import type { ComponentType } from "react";
import type { LedgerKind } from "@/types/api";

const KIND_VARIANT: Record<LedgerKind, "secondary" | "success" | "danger"> = {
  PENALTY: "danger",
  PAYMENT: "success",
  ADJUSTMENT: "secondary",
};

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

export function AdminFundPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "fund"],
    queryFn: () => adminApi.fund(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
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
        title="Không tải được quỹ phạt"
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
        title="Quỹ phạt"
        subtitle="Tổng quỹ toàn hệ thống: phạt đã chốt, tiền đã thu và sổ cái gần đây."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Wallet}
          label="Tổng phạt (đã chốt)"
          value={formatVND(data.grandTotalPenalty)}
          tone={data.grandTotalPenalty > 0 ? "danger" : "success"}
        />
        <StatCard
          icon={CircleDollarSign}
          label="Đã thu"
          value={formatVND(data.grandTotalPaid)}
          tone="success"
        />
        <StatCard
          icon={AlertTriangle}
          label="Chưa thu"
          value={formatVND(Math.max(0, data.grandOutstanding))}
          tone={data.grandOutstanding > 0 ? "danger" : "success"}
        />
      </div>

      <Card className="mt-6 border-slate-200/80">
        <CardHeader>
          <CardTitle className="text-base">Theo nhóm</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.groups.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">Chưa có nhóm nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 font-medium">Nhóm</th>
                    <th className="px-4 py-2.5 text-right font-medium">Phạt</th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Đã đóng
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Còn nợ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.groups.map((g) => (
                    <tr key={g.groupId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {g.name}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-rose-600">
                        {formatVND(g.totalPenalty)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600">
                        {formatVND(g.totalPaid)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold tabular-nums ${
                          g.outstanding > 0 ? "text-rose-600" : "text-slate-500"
                        }`}
                      >
                        {formatVND(g.outstanding)}
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
          <CardTitle className="text-base">
            Sổ cái gần đây (50 giao dịch mới nhất)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentEntries.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">Chưa có giao dịch nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 font-medium">Loại</th>
                    <th className="px-4 py-2.5 font-medium">Nhóm</th>
                    <th className="px-4 py-2.5 font-medium">User</th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Số tiền
                    </th>
                    <th className="px-4 py-2.5 font-medium">Ghi chú</th>
                    <th className="px-4 py-2.5 font-medium">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            KIND_VARIANT[e.kind as LedgerKind] ?? "secondary"
                          }
                        >
                          {LEDGER_KIND_LABELS[e.kind as LedgerKind] ?? e.kind}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        {e.groupName}
                      </td>
                      <td className="px-4 py-3 text-slate-800">{e.userName}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium tabular-nums ${
                          e.kind === "PAYMENT"
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {e.kind === "PAYMENT" ? "+" : "−"}
                        {formatVND(e.amount)}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-slate-500">
                        {e.note ?? "—"}
                        {e.createdBy ? (
                          <span className="text-xs text-slate-400">
                            {" "}
                            · {e.createdBy}
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                        {fmtDateTime(e.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
