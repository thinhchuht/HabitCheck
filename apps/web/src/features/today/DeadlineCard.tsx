import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fmtTime, formatCountdown } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import type { TodayItemDto } from "@/types/api";
import { CheckInDialog } from "./CheckInDialog";
import { firstCheckinTime } from "./TodayItemCard";

interface DeadlineCardProps {
  item: TodayItemDto;
}

/** Body for DEADLINE activities: countdown / late state + check-in action. */
export function DeadlineCard({ item }: DeadlineCardProps) {
  const now = useNow();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { deadlineAt, state } = item;

  const passed = deadlineAt != null && Date.parse(deadlineAt) > now;
  const firstAt = firstCheckinTime(item);

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        {deadlineAt == null ? (
          <p className="text-sm text-slate-500">Chưa đặt giờ hạn.</p>
        ) : passed ? (
          <p className="text-sm text-slate-600">
            Hạn {fmtTime(deadlineAt)} — còn{" "}
            <span className="font-mono font-semibold text-indigo-600">
              {formatCountdown(Date.parse(deadlineAt), now)}
            </span>
          </p>
        ) : (
          <p className="text-sm font-semibold text-rose-600">
            ĐÃ TRỄ (hạn {fmtTime(deadlineAt)})
          </p>
        )}
        {firstAt ? (
          <p className="mt-1 text-xs text-slate-400">
            Check-in đầu tiên lúc {firstAt}
            {item.activity.graceMinutes > 0
              ? ` (chậm thêm ${item.activity.graceMinutes} phút)`
              : ""}
          </p>
        ) : null}
      </div>

      {state !== "PASS" ? (
        <Button className="w-full" onClick={() => setDialogOpen(true)}>
          Check-in
        </Button>
      ) : null}

      <CheckInDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        activity={item.activity}
        kind="CHECKIN"
      />
    </div>
  );
}
