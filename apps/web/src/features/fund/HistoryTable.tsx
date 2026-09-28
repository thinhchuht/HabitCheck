import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LEDGER_KIND_LABELS } from "@/lib/constants";
import { formatVND, fmtDate, fmtDateTime } from "@/lib/format";
import type { BadgeProps } from "@/components/ui/badge";
import type { FundHistoryEntry, LedgerKind } from "@/types/api";

interface HistoryTableProps {
  history: FundHistoryEntry[];
}

const KIND_VARIANT: Record<LedgerKind, BadgeProps["variant"]> = {
  PENALTY: "danger",
  PAYMENT: "success",
  ADJUSTMENT: "secondary",
};

function displayAmount(entry: FundHistoryEntry): string {
  if (entry.kind === "PAYMENT") return `−${formatVND(Math.abs(entry.amount))}`;
  if (entry.kind === "PENALTY") return `+${formatVND(Math.abs(entry.amount))}`;
  return entry.amount >= 0 ? `+${formatVND(entry.amount)}` : `−${formatVND(-entry.amount)}`;
}

export function HistoryTable({ history }: HistoryTableProps) {
  if (history.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lịch sử quỹ</CardTitle>
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
              {history.map((h) => (
                <tr key={h.id} className="border-b border-slate-100 last:border-0 align-top">
                  <td className="whitespace-nowrap py-3 pr-4 text-slate-500">
                    {fmtDateTime(h.createdAt)}
                  </td>
                  <td className="py-3 pr-4 font-medium text-slate-800">{h.displayName}</td>
                  <td className="py-3 pr-4">
                    <Badge variant={KIND_VARIANT[h.kind]}>{LEDGER_KIND_LABELS[h.kind]}</Badge>
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
      </CardContent>
    </Card>
  );
}
