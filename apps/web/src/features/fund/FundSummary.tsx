import { BadgeCheck, ScrollText, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatVND } from "@/lib/format";
import type { FundDto } from "@/types/api";

interface FundSummaryProps {
  fund: FundDto;
}

export function FundSummary({ fund }: FundSummaryProps) {
  const cards = [
    {
      label: "Tổng phạt đã ghi sổ",
      value: fund.totalPenalty,
      accent: "text-slate-900",
      icon: ScrollText,
      iconClass: "bg-slate-100 text-slate-600",
    },
    {
      label: "Tổng đã đóng",
      value: fund.totalPaid,
      accent: "text-emerald-600",
      icon: BadgeCheck,
      iconClass: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Còn nợ",
      value: fund.totalOutstanding,
      accent: fund.totalOutstanding > 0 ? "text-rose-600" : "text-emerald-600",
      icon: Wallet,
      iconClass:
        fund.totalOutstanding > 0
          ? "bg-rose-50 text-rose-600"
          : "bg-emerald-50 text-emerald-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                {formatVND(c.value)}
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
