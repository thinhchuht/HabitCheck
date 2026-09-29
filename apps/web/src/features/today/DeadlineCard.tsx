import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fmtTime, formatCountdown } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import type { TodayItemDto } from "@/types/api";
import { CheckInDialog } from "./CheckInDialog";
import { firstCheckinTime } from "./TodayItemCard";

/** Cửa sổ check-in DEADLINE: ±5 phút quanh mốc giờ (đúng quy tắc server). */
const WINDOW_MS = 5 * 60 * 1000;

interface DeadlineCardProps {
  item: TodayItemDto;
}

/** Body for DEADLINE activities: cửa sổ ±5 phút quanh mốc giờ + nút check-in. */
export function DeadlineCard({ item }: DeadlineCardProps) {
  const now = useNow();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { deadlineAt, state } = item;

  const deadline = deadlineAt != null ? Date.parse(deadlineAt) : null;
  const firstAt = firstCheckinTime(item);

  let status:
    | "no-deadline"
    | "pass"
    | "before"
    | "countdown"
    | "grace"
    | "missed" = "no-deadline";
  if (deadline != null) {
    const windowStart = deadline - WINDOW_MS;
    const windowEnd = deadline + WINDOW_MS;
    if (state === "PASS") status = "pass";
    else if (now < windowStart) status = "before";
    else if (now > windowEnd) status = "missed";
    else if (now < deadline) status = "countdown";
    else status = "grace";
  }
  const inWindow = status === "countdown" || status === "grace";

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        {status === "no-deadline" ? (
          <p className="text-sm text-slate-500">Chưa đặt giờ hạn.</p>
        ) : status === "pass" ? (
          <p className="text-sm font-semibold text-emerald-600">
            ĐÃ CHECK-IN (hạn {fmtTime(deadlineAt)})
          </p>
        ) : status === "before" ? (
          <p className="text-sm text-slate-600">
            Chưa mở giờ check-in — chỉ nhận từ{" "}
            <span className="font-mono font-semibold text-slate-800">
              {fmtTime(deadline! - WINDOW_MS)}–{fmtTime(deadline! + WINDOW_MS)}
            </span>{" "}
            (±5 phút quanh mốc {fmtTime(deadlineAt)}).
          </p>
        ) : status === "missed" ? (
          <p className="text-sm font-semibold text-rose-600">
            ĐÃ QUÁ GIỜ (hạn {fmtTime(deadlineAt)}, chốt lúc{" "}
            {fmtTime(deadline! + WINDOW_MS)})
          </p>
        ) : status === "countdown" ? (
          <p className="text-sm text-slate-600">
            Hạn {fmtTime(deadlineAt)} — còn{" "}
            <span className="font-mono font-semibold text-indigo-600">
              {formatCountdown(deadline!, now)}
            </span>
          </p>
        ) : (
          <p className="text-sm text-amber-600">
            Đã qua hạn {fmtTime(deadlineAt)} — vẫn kịp check-in, còn{" "}
            <span className="font-mono font-semibold">
              {formatCountdown(deadline! + WINDOW_MS, now)}
            </span>
          </p>
        )}
        {firstAt ? (
          <p className="mt-1 text-xs text-slate-400">
            Check-in đầu tiên lúc {firstAt} (chỉ nhận ±5 phút quanh mốc giờ)
          </p>
        ) : null}
      </div>

      {state !== "PASS" ? (
        <Button
          className="w-full"
          disabled={!inWindow}
          onClick={() => setDialogOpen(true)}
        >
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
