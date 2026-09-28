import { Card, CardContent } from "@/components/ui/card";
import { formatVND } from "@/lib/format";
import type { PersonalStatsDto } from "@/types/api";

interface StatCardsProps {
  stats: PersonalStatsDto;
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function StatCards({ stats }: StatCardsProps) {
  const cards = [
    { label: "Tỷ lệ hoàn thành", value: pct(stats.completionRate), accent: "text-indigo-600" },
    { label: "Streak hiện tại", value: `${stats.currentStreak} ngày`, accent: "text-emerald-600" },
    { label: "Streak dài nhất", value: `${stats.bestStreak} ngày`, accent: "text-amber-600" },
    { label: "Tổng tiền phạt", value: formatVND(stats.totalPenalty), accent: "text-rose-600" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {c.label}
            </p>
            <p className={`mt-1.5 text-2xl font-bold ${c.accent}`}>{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
