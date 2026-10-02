import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fundApi } from "@/api/fund";
import { getApiErrorMessage } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { LEDGER_KIND_LABELS } from "@/lib/constants";
import { formatVND, fmtDate, fmtDateTime } from "@/lib/format";
import type { BadgeProps } from "@/components/ui/badge";
import type { LedgerKind } from "@/types/api";

const PAGE_SIZE = 20;

interface HistoryTableProps {
  groupId: string;
}

const KIND_VARIANT: Record<LedgerKind, BadgeProps["variant"]> = {
  PENALTY: "danger",
  PAYMENT: "success",
  ADJUSTMENT: "secondary",
};

function displayAmount(entry: { amount: number; kind: LedgerKind }): string {
  if (entry.kind === "PAYMENT") return `−${formatVND(Math.abs(entry.amount))}`;
  if (entry.kind === "PENALTY") return `+${formatVND(Math.abs(entry.amount))}`;
  return entry.amount >= 0
    ? `+${formatVND(entry.amount)}`
    : `−${formatVND(-entry.amount)}`;
}

export function HistoryTable({ groupId }: HistoryTableProps) {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["fund-history", groupId, page],
    queryFn: () => fundApi.history(groupId, page, PAGE_SIZE),
    enabled: groupId != null,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lịch sử quỹ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-7 w-7" />}
        title="Không tải được lịch sử quỹ"
        description={getApiErrorMessage(error)}
        action={
          <Button variant="outline" onClick={() => void refetch()}>
            Thử lại
          </Button>
        }
      />
    );
  }

  if (!data || data.items.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Lịch sử quỹ{" "}
          <span className="font-normal text-slate-400">({data.total})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">Thời gian</th>
                <th className="py-2 pr-4">Người</th>
                <th className="py-2 pr-4">Loại</th>
                <th className="py-2 pr-4 text-right">Số tiền</th>
                <th className="py-2 pr-4">Ngày tham chiếu</th>
                <th className="py-2">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((h) => (
                <tr
                  key={h.id}
                  className="border-b border-slate-100 last:border-0 align-top"
                >
                  <td className="whitespace-nowrap py-3 pr-4 text-slate-500">
                    {fmtDateTime(h.createdAt)}
                  </td>
                  <td className="py-3 pr-4 font-medium text-slate-800">
                    {h.displayName}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant={KIND_VARIANT[h.kind]}>
                      {LEDGER_KIND_LABELS[h.kind]}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 text-right font-semibold text-slate-900">
                    {displayAmount(h)}
                  </td>
                  <td className="py-3 pr-4 text-slate-500">
                    {h.refDate ? fmtDate(h.refDate) : "—"}
                  </td>
                  <td className="py-3 text-slate-500">{h.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </CardContent>
    </Card>
  );
}
