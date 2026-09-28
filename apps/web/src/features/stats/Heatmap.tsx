import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { statsApi } from "@/api/stats";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fmtDate, vn, vnNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HeatmapDay } from "@/types/api";

const STATE_CLASSES: Record<HeatmapDay["state"], string> = {
  PASS: "bg-emerald-500",
  PARTIAL: "bg-amber-400",
  FAIL: "bg-rose-500",
  NONE: "bg-slate-100",
};

const STATE_LABELS: Record<HeatmapDay["state"], string> = {
  PASS: "Đạt tất cả",
  PARTIAL: "Fail 1",
  FAIL: "Fail ≥ 2",
  NONE: "Không có dữ liệu",
};

interface HeatmapProps {
  year: number;
  onYearChange: (year: number) => void;
}

export function Heatmap({ year, onYearChange }: HeatmapProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["heatmap", year],
    queryFn: () => statsApi.heatmap(year),
  });

  const weeks = useMemo(() => {
    if (!data) return [];
    const dayMap = new Map<string, HeatmapDay>(
      data.days.map((d) => [d.date, d]),
    );
    const start = dayjsYearStart(year);
    const end = dayjsYearEnd(year);
    const totalDays = end.diff(start, "day") + 1;
    // Monday-start offset: Sunday=0..Saturday=6 → (day+6)%7
    const offset = (start.day() + 6) % 7;

    const cells: (string | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let i = 0; i < totalDays; i++) {
      cells.push(start.add(i, "day").format("YYYY-MM-DD"));
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const result: Array<Array<{ date: string; day: HeatmapDay } | null>> = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(
        cells.slice(i, i + 7).map((c) =>
          c
            ? {
                date: c,
                day: dayMap.get(c) ?? {
                  date: c,
                  state: "NONE",
                  failed: 0,
                  total: 0,
                },
              }
            : null,
        ),
      );
    }
    return result;
  }, [data, year]);

  const currentYear = vnNow().year();

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">
            Lịch nhiệt năm {year}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onYearChange(year - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {year !== currentYear ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onYearChange(currentYear)}
              >
                Năm nay
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onYearChange(year + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="h-56 animate-pulse rounded-xl bg-slate-100" />
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-[3px]">
              {weeks.map((week, wi) => {
                const firstReal = week.find((c) => c != null);
                const prevWeek = weeks[wi - 1];
                const prevLast = prevWeek
                  ? [...prevWeek].reverse().find((c) => c != null)
                  : undefined;
                const monthLabel =
                  firstReal &&
                  (!prevLast ||
                    vn(prevLast.date).month() !== vn(firstReal.date).month())
                    ? vn(firstReal.date).format("MMM")
                    : "\u00A0";
                return (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    <div className="h-4 pr-[3px] text-right text-[10px] leading-4 text-slate-400">
                      {monthLabel}
                    </div>
                    {week.map((cell, di) =>
                      cell ? (
                        <span
                          key={di}
                          title={`${fmtDate(cell.date)} — ${STATE_LABELS[cell.day.state]}`}
                          className={cn(
                            "h-3.5 w-3.5 rounded",
                            STATE_CLASSES[cell.day.state],
                          )}
                        />
                      ) : (
                        <span key={di} className="h-3.5 w-3.5" />
                      ),
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-end gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-emerald-500" /> Đạt
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-amber-400" /> Fail 1
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-rose-500" /> Fail ≥ 2
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-slate-100" /> Không có
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function dayjsYearStart(year: number) {
  return dayjs(`${year}-01-01`);
}
function dayjsYearEnd(year: number) {
  return dayjs(`${year}-12-31`);
}
