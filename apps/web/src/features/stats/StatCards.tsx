import { Flame, Target, Trophy, Wallet } from "lucide-react";
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
    {
      label: "Tỷ lệ hoàn thành",
      value: pct(stats.completionRate),
      accent: "text-indigo-600",
      icon: Target,
      iconClass: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Streak hiện tại",
      value: `${stats.currentStreak} ngày`,
      accent: "text-emerald-600",
      icon: Flame,
      iconClass: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Streak dài nhất",
      value: `${stats.bestStreak} ngày`,
      accent: "text-amber-600",
      icon: Trophy,
      iconClass: "bg-amber-50 text-amber-600",
    },
    {
      label: "Tổng tiền phạt",
      value: formatVND(stats.totalPenalty),
      accent: "text-rose-600",
      icon: Wallet,
      iconClass: "bg-rose-50 text-rose-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="transition-shadow hover:shadow-md">
          <CardContent className="flex items-start justify-between gap-3 p-5">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {c.label}
              </p>
              <p
                className={`mt-1.5 truncate text-2xl font-bold tabular-nums ${c.accent}`}
              >
                {c.value}
              </p>
            </div>
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c.iconClass}`}
            >
              <c.icon className="h-5 w-5" />
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
