import { AlertTriangle, BarChart3, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/admin";
import { getApiErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate, formatVND } from "@/lib/format";

function passRateText(rate: number | null): string {
  return rate == null ? "—" : `${(rate * 100).toFixed(1)}%`;
}

export function AdminStatsPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "stats", "overview"],
    queryFn: () => adminApi.statsOverview(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
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
        title="Thống kê"
        subtitle="Xu hướng 14 ngày, xếp hạng nhóm và các user chịu phạt nhiều nhất."
      />

      <Card className="border-slate-200/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-indigo-500" />
            Xu hướng 14 ngày gần nhất
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 font-medium">Ngày</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Check-in
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Phạt (đã chốt)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.dailyTrend.map((d) => (
                  <tr key={d.date} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      {fmtDate(d.date)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {d.checkins}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums ${
                        d.penaltyVnd > 0 ? "text-rose-600" : "text-slate-400"
                      }`}
                    >
                      {formatVND(d.penaltyVnd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4 border-slate-200/80">
        <CardHeader>
          <CardTitle className="text-base">Xếp hạng nhóm</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.groupRanking.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">
              Chưa có nhóm nào có ngày đã chốt.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 font-medium">Nhóm</th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Thành viên
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Ngày chốt
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Ngày fail
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Tỷ lệ đạt
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Tổng phạt
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.groupRanking.map((g) => (
                    <tr key={g.groupId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {g.name}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {g.memberCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {g.settledDays}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums ${
                          g.failedDays > 0 ? "text-rose-600" : "text-slate-500"
                        }`}
                      >
                        {g.failedDays}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {passRateText(g.passRate)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium tabular-nums ${
                          g.totalPenalty > 0
                            ? "text-rose-600"
                            : "text-slate-500"
                        }`}
                      >
                        {formatVND(g.totalPenalty)}
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
            <Trophy className="h-5 w-5 text-amber-500" />
            Top 10 user chịu phạt nhiều nhất
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.topPenaltyUsers.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">
              Chưa có ai bị phạt.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 font-medium">User</th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Ngày fail
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Tổng phạt
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.topPenaltyUsers.map((u) => (
                    <tr key={u.userId} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">
                          {u.displayName}
                        </p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-rose-600">
                        {u.failedDays}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-rose-600">
                        {formatVND(u.totalPenalty)}
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
