import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fmtTime, formatCountdown } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import type { TodayItemDto } from "@/types/api";
import { CheckInDialog } from "./CheckInDialog";
import { firstCheckinTime } from "./TodayItemCard";

/** Cửa sổ check-in DEADLINE (đúng quy tắc server): sớm nhất 2h trước mốc, muộn nhất 10 phút sau mốc. */
const EARLY_MS = 2 * 60 * 60 * 1000;
const LATE_MS = 10 * 60 * 1000;

interface DeadlineCardProps {
  item: TodayItemDto;
}

/** Body for DEADLINE activities: cửa sổ 2h trước – 10 phút sau mốc + nút check-in. */
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
  // Cửa sổ hiệu lực: mặc định cửa sổ "hôm nay" tính từ deadlineAt (server đã neo mốc sớm
  // <02:00 sang 0:00 sáng hôm sau). Sau 0:00 trang "Hôm nay" là ngày mới nên cửa sổ ngày mới
  // chưa mở, nhưng phần grace cuối của ngày trước (VD 0:00–0:10 với mốc 0:00) nằm ở cửa sổ
  // deadlineAt − 24h → nếu now còn trong đó vẫn mở nút (server nhận, tính cho ngày trước).
  let windowStart = 0;
  let windowEnd = 0;
  let anchor = 0;
  if (deadline != null) {
    windowStart = deadline - EARLY_MS;
    windowEnd = deadline + LATE_MS;
    anchor = deadline;
    const DAY_MS = 24 * 60 * 60 * 1000;
    if (now >= windowStart - DAY_MS && now <= windowEnd - DAY_MS) {
      windowStart -= DAY_MS;
      windowEnd -= DAY_MS;
      anchor -= DAY_MS;
    }
    if (state === "PASS") status = "pass";
    else if (now < windowStart) status = "before";
    else if (now > windowEnd) status = "missed";
    else if (now < anchor) status = "countdown";
    else status = "grace";
  }
  const inWindow = status === "countdown" || status === "grace";

  const boxClass =
    status === "pass"
      ? "bg-emerald-50 ring-1 ring-inset ring-emerald-100"
      : status === "missed"
        ? "bg-rose-50 ring-1 ring-inset ring-rose-100"
        : status === "countdown"
          ? "bg-indigo-50 ring-1 ring-inset ring-indigo-100"
          : status === "grace"
            ? "bg-amber-50 ring-1 ring-inset ring-amber-100"
            : "bg-slate-50";

  return (
    <div className="space-y-3">
      <div className={`rounded-xl px-4 py-3 ${boxClass}`}>
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
              {fmtTime(windowStart)}–{fmtTime(windowEnd)}
            </span>{" "}
            (sớm nhất 2h trước mốc {fmtTime(anchor)}, muộn nhất 10 phút sau).
          </p>
        ) : status === "missed" ? (
          <p className="text-sm font-semibold text-rose-600">
            ĐÃ QUÁ GIỜ (hạn {fmtTime(anchor)}, chốt lúc {fmtTime(windowEnd)})
          </p>
        ) : status === "countdown" ? (
          <p className="text-sm text-slate-600">
            Hạn {fmtTime(anchor)} — còn{" "}
            <span className="font-mono font-semibold text-indigo-600">
              {formatCountdown(anchor, now)}
            </span>
          </p>
        ) : (
          <p className="text-sm text-amber-600">
            Đã qua hạn {fmtTime(anchor)} — vẫn kịp check-in, còn{" "}
            <span className="font-mono font-semibold">
              {formatCountdown(windowEnd, now)}
            </span>
          </p>
        )}
        {firstAt ? (
          <p className="mt-1 text-xs text-slate-400">
            Check-in đầu tiên lúc {firstAt} (chỉ nhận từ 2h trước đến 10 phút
            sau mốc giờ)
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
