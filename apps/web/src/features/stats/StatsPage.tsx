import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { statsApi } from "@/api/stats";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatVND, fmtDate, vnNow } from "@/lib/format";
import { useAppStore } from "@/store/app";
import { ByActivityTable } from "./ByActivityTable";
import { Heatmap } from "./Heatmap";
import { Leaderboard } from "./Leaderboard";
import { PenaltyChart } from "./PenaltyChart";
import { StatCards } from "./StatCards";

const RANGES = [7, 30, 90] as const;

export function StatsPage() {
  const groupId = useAppStore((s) => s.selectedGroupId);
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [year, setYear] = useState(vnNow().year());

  const to = vnNow().format("YYYY-MM-DD");
  const from = vnNow()
    .subtract(range - 1, "day")
    .format("YYYY-MM-DD");

  const { data, isLoading } = useQuery({
    queryKey: ["stats", from, to],
    queryFn: () => statsApi.me({ from, to }),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Thống kê" subtitle={`Khoảng ${from} → ${to}`} />

      <div className="flex gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              range === r
                ? "bg-indigo-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {r} ngày
          </button>
        ))}
      </div>

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">Cá nhân</TabsTrigger>
          <TabsTrigger value="leaderboard">Xếp hạng nhóm</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          {isLoading || !data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                ))}
              </div>
              <Skeleton className="h-72 w-full rounded-2xl" />
            </div>
          ) : (
            <div className="space-y-5">
              <StatCards stats={data} />

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Phạt & hoạt động đạt theo ngày
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PenaltyChart byDay={data.byDay} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Theo hoạt động</CardTitle>
                </CardHeader>
                <CardContent>
                  <ByActivityTable rows={data.byActivity} />
                </CardContent>
              </Card>

              {data.byChallenge.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Theo kỳ thử thách
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.byChallenge.map((c) => (
                      <div
                        key={c.challengeId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-2.5 text-sm"
                      >
                        <span className="font-medium text-slate-800">
                          {c.title}
                        </span>
                        <span className="text-slate-400">
                          {fmtDate(c.from)} → {fmtDate(c.to)}
                        </span>
                        <span className="font-semibold text-indigo-600">
                          {Math.round(c.completionRate * 100)}%
                        </span>
                        <span className="font-medium text-rose-600">
                          {formatVND(c.totalPenalty)}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}

              <Heatmap year={year} onYearChange={setYear} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="leaderboard">
          {groupId ? (
            <Leaderboard groupId={groupId} from={from} to={to} />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
