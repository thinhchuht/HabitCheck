import { Badge } from "@/components/ui/badge";
import { FAIL_REASON_LABELS } from "@/lib/constants";
import type { FailReason, TodayItemState } from "@/types/api";

interface StatusBadgeProps {
  state: TodayItemState;
  failReason: FailReason | null;
  isLate?: boolean;
}

/** PENDING → grey "Chưa làm", PASS → emerald "Đạt", FAIL → rose + failReason label. */
export function StatusBadge({ state, failReason, isLate = false }: StatusBadgeProps) {
  if (state === "PASS") return <Badge variant="success">Đạt</Badge>;
  if (state === "FAIL") {
    return <Badge variant="danger">{failReason ? FAIL_REASON_LABELS[failReason] : "Không đạt"}</Badge>;
  }
  if (isLate) return <Badge variant="warning">Trễ</Badge>;
  return <Badge variant="secondary">Chưa làm</Badge>;
}
