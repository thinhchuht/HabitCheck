import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/components/Pagination";
import { formatVND } from "@/lib/format";
import { firstName } from "@/lib/utils";
import type { FundDebt } from "@/types/api";

interface DebtTableProps {
  debts: FundDebt[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function DebtTable({
  debts,
  page,
  totalPages,
  onPageChange,
}: DebtTableProps) {
  if (debts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Số dư từng thành viên</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">Thành viên</th>
                <th className="py-2 pr-4 text-right">Tổng phạt</th>
                <th className="py-2 pr-4 text-right">Đã đóng</th>
                <th className="py-2 text-right">Còn nợ</th>
              </tr>
            </thead>
            <tbody>
              {debts.map((d) => (
                <tr
                  key={d.userId}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-2.5 font-medium text-slate-800">
                      <Avatar className="h-8 w-8">
                        {d.avatarUrl ? (
                          <AvatarImage src={d.avatarUrl} alt={d.displayName} />
                        ) : null}
                        <AvatarFallback>
                          {firstName(d.displayName).toUpperCase().slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      {d.displayName}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right text-slate-600">
                    {formatVND(d.totalPenalty)}
                  </td>
                  <td className="py-3 pr-4 text-right text-emerald-600">
                    {formatVND(d.totalPaid)}
                  </td>
                  <td className="py-3 text-right">
                    {d.balance > 0 ? (
                      <span className="font-semibold text-rose-600">
                        {formatVND(d.balance)}
                      </span>
                    ) : (
                      <Badge variant="success">Đã đủ</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </CardContent>
    </Card>
  );
}
