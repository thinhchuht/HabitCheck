import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVND } from "@/lib/format";
import type { PenaltyTiers } from "@/types/api";

interface PenaltyPreviewProps {
  tiers: PenaltyTiers;
}

/** Read-only table of the group's penalty tiers (bậc phạt). */
export function PenaltyPreview({ tiers }: PenaltyPreviewProps) {
  const rows = tiers.tiers.slice(1);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Bảng phạt của nhóm</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        {rows.map((amount, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-slate-600">{i + 1} hoạt động fail trong ngày</span>
            <span className="font-semibold text-slate-900">{formatVND(amount)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
          <span className="text-slate-600">Mỗi hoạt động fail thêm (sau bậc {rows.length})</span>
          <span className="font-semibold text-slate-900">
            +{formatVND(tiers.extraPerActivity)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
