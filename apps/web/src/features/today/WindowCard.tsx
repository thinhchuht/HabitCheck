import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fmtTime } from "@/lib/format";
import type { TodayItemDto } from "@/types/api";
import { CheckInDialog } from "./CheckInDialog";
import { firstCheckinTime } from "./TodayItemCard";

interface WindowCardProps {
  item: TodayItemDto;
}

/** Body for WINDOW activities: window info + check-in action. */
export function WindowCard({ item }: WindowCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { activity, state } = item;
  const firstAt = firstCheckinTime(item);

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <p className="text-sm text-slate-600">
          Khung giờ{" "}
          <span className="font-semibold text-slate-900">
            {fmtTime(activity.windowStart)} – {fmtTime(activity.windowEnd)}
          </span>
        </p>
        {firstAt ? (
          <p className="mt-1 text-xs text-slate-400">Check-in lúc {firstAt}</p>
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
        activity={activity}
        kind="CHECKIN"
      />
    </div>
  );
}
