import { Clock, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACTIVITY_TYPE_LABELS, PROOF_TYPE_LABELS } from "@/lib/constants";
import { fmtTimeOnly } from "@/lib/format";
import { isEmojiLike } from "@/lib/utils";
import type { ActivityDto } from "@/types/api";

/** Short parameter summary per activity type. */
export function activitySummary(a: ActivityDto): string {
  switch (a.type) {
    case "DEADLINE":
      return `trước ${fmtTimeOnly(a.deadlineTime)} (chỉ nhận 2h trước – 10 phút sau)`;
    case "DURATION":
      return `${a.targetMinutes ?? 0} phút/ngày — tick + 1 ảnh`;
    case "WINDOW":
      return `khung ${fmtTimeOnly(a.windowStart)} – ${fmtTimeOnly(a.windowEnd)}`;
  }
}

interface ActivityRowProps {
  activity: ActivityDto;
  editable?: boolean;
  onEdit?: (activity: ActivityDto) => void;
  onDelete?: (activity: ActivityDto) => void;
}

export function ActivityRow({
  activity,
  editable = false,
  onEdit,
  onDelete,
}: ActivityRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-lg">
        {isEmojiLike(activity.icon) ? (
          (activity.icon as string)
        ) : (
          <Clock className="h-5 w-5 text-indigo-500" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="font-semibold text-slate-900">{activity.name}</p>
          <Badge variant="outline">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
          <Badge variant="secondary">
            {PROOF_TYPE_LABELS[activity.proofType]}
          </Badge>
          {activity.unit ? (
            <Badge variant="default">{activity.unit}</Badge>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-sm text-slate-500">
          {activitySummary(activity)}
        </p>
        {activity.description ? (
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {activity.description}
          </p>
        ) : null}
      </div>
      {editable ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            title="Sửa"
            onClick={() => onEdit?.(activity)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-rose-600 hover:text-rose-700"
            title="Xoá"
            onClick={() => onDelete?.(activity)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
