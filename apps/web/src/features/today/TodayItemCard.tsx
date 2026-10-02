import { Clock } from "lucide-react";
import type { ReactNode } from "react";
import { MediaThumb } from "@/components/MediaThumb";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ACTIVITY_TYPE_LABELS } from "@/lib/constants";
import { isEmojiLike } from "@/lib/utils";
import { fmtTime } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import type { TodayItemDto } from "@/types/api";

interface TodayItemCardProps {
  item: TodayItemDto;
  /** Type-specific body (countdown, progress, actions, dialogs…). */
  content: ReactNode;
}

export function TodayItemCard({ item, content }: TodayItemCardProps) {
  const { activity, state, failReason, isLate, checkins } = item;

  const lastMedia = [...checkins]
    .sort((a, b) => (a.checkinAt < b.checkinAt ? 1 : -1))
    .slice(0, 6)
    .map((c) => c.checkinMedia);
  const lastNote = [...checkins]
    .sort((a, b) => (a.checkinAt < b.checkinAt ? 1 : -1))
    .map((c) => c.note)
    .find((n) => n != null);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl">
              {isEmojiLike(activity.icon) ? (
                (activity.icon as string)
              ) : (
                <Clock className="h-5 w-5 text-indigo-500" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-900">
                {activity.name}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">
                  {ACTIVITY_TYPE_LABELS[activity.type]}
                </Badge>
                {activity.unit ? (
                  <Badge variant="default">{activity.unit}</Badge>
                ) : null}
                <StatusBadge
                  state={state}
                  failReason={failReason}
                  isLate={isLate}
                />
              </div>
            </div>
          </div>
        </div>

        {activity.description ? (
          <p className="text-sm text-slate-500">{activity.description}</p>
        ) : null}

        {content}

        {lastMedia.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {lastMedia.map((m) => (
              <MediaThumb key={m.publicId} media={m} size="sm" />
            ))}
          </div>
        ) : null}

        {lastNote ? (
          <p className="text-xs italic text-slate-400">“{lastNote}”</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Show when a PENDING deadline is past its limit (used by cards). */
export function firstCheckinTime(item: TodayItemDto): string | null {
  if (item.checkins.length === 0) return null;
  const first = item.checkins.reduce((a, b) =>
    a.checkinAt <= b.checkinAt ? a : b,
  );
  return fmtTime(first.checkinAt);
}
