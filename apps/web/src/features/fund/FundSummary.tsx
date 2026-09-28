import { Card, CardContent } from "@/components/ui/card";
import { formatVND } from "@/lib/format";
import type { FundDto } from "@/types/api";

interface FundSummaryProps {
  fund: FundDto;
}

export function FundSummary({ fund }: FundSummaryProps) {
  const cards = [
    { label: "Tổng phạt đã ghi sổ", value: fund.totalPenalty, accent: "text-slate-900" },
    { label: "Tổng đã đóng", value: fund.totalPaid, accent: "text-emerald-600" },
    {
      label: "Còn nợ",
      value: fund.totalOutstanding,
      accent: fund.totalOutstanding > 0 ? "text-rose-600" : "text-emerald-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {c.label}
            </p>
            <p className={`mt-1.5 text-2xl font-bold ${c.accent}`}>{formatVND(c.value)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
