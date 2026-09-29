import { Check } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CHECKIN_STATUS_LABELS } from "@/lib/constants";
import { formatMinutesVN, fmtTime } from "@/lib/format";
import type { CheckInStatus, TodayItemDto } from "@/types/api";
import { CheckInDialog } from "./CheckInDialog";

interface DurationCardProps {
  item: TodayItemDto;
}

function statusVariant(
  status: CheckInStatus,
): "success" | "default" | "danger" | "secondary" {
  if (status === "COMPLETED") return "success";
  if (status === "OPEN") return "default";
  if (status === "REJECTED") return "danger";
  return "secondary";
}

/** Body for DURATION activities (VD: "thể dục 1 giờ"): tick + 1 ảnh trong ngày. */
export function DurationCard({ item }: DurationCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const target = item.activity.targetMinutes ?? 0;

  const checkins = [...item.checkins].sort((a, b) =>
    a.checkinAt < b.checkinAt ? -1 : 1,
  );
  const firstAt = checkins.length > 0 ? checkins[0].checkinAt : null;

  const done = item.state === "PASS";

  return (
    <div className="space-y-3">
      <div
        className={`rounded-xl px-4 py-3 ${
          done
            ? "bg-emerald-50 ring-1 ring-inset ring-emerald-100"
            : "bg-slate-50"
        }`}
      >
        <p
          className={`text-sm ${done ? "text-emerald-800" : "text-slate-600"}`}
        >
          Thời lượng mục tiêu:{" "}
          <span className="font-semibold text-slate-900">
            {formatMinutesVN(target)}
          </span>
        </p>
        {firstAt ? (
          <p className="mt-1 text-xs text-slate-500">
            Đã check-in lúc {fmtTime(firstAt)}
          </p>
        ) : null}
      </div>

      {checkins.length > 0 ? (
        <ul className="space-y-1.5">
          {checkins.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm"
            >
              <span className="text-slate-600">
                Check-in lúc {fmtTime(c.checkinAt)}
              </span>
              <Badge variant={statusVariant(c.status)}>
                {CHECKIN_STATUS_LABELS[c.status]}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {item.state === "PASS" ? (
        <Button className="w-full" disabled>
          <Check className="mr-1.5 h-4 w-4" />
          Đã hoàn thành
        </Button>
      ) : (
        <Button className="w-full" onClick={() => setDialogOpen(true)}>
          <Check className="mr-1.5 h-4 w-4" />
          Hoàn thành (tick + chụp ảnh)
        </Button>
      )}

      <CheckInDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        activity={item.activity}
        kind="CHECKIN"
      />
    </div>
  );
}
