import { Check, Circle, Clock, X } from "lucide-react";
import { FAIL_REASON_LABELS } from "@/lib/constants";
import { isEmojiLike } from "@/lib/utils";
import type { FailReason, LiveBoardItem } from "@/types/api";

interface ExpandableItemsProps {
  items: LiveBoardItem[];
}

function reasonLabel(failReason: string | null): string | null {
  if (failReason == null) return null;
  return failReason in FAIL_REASON_LABELS
    ? FAIL_REASON_LABELS[failReason as FailReason]
    : failReason;
}

/** Per-member activity rows: ✅ đạt / ❌ fail (+lý do) / ⏳ trễ / ⬜ chưa làm. */
export function ExpandableItems({ items }: ExpandableItemsProps) {
  if (items.length === 0) {
    return <p className="px-1 py-2 text-sm text-slate-400">Chưa có hoạt động nào.</p>;
  }
  return (
    <ul className="space-y-1 border-t border-slate-100 px-4 py-3">
      {items.map((item) => {
        const reason = reasonLabel(item.failReason);
        return (
          <li key={item.activityId} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-slate-700">
              {isEmojiLike(item.icon) ? (
                <span className="text-base">{item.icon as string}</span>
              ) : null}
              <span className="truncate">{item.name}</span>
            </span>
            {item.state === "PASS" ? (
              <span className="flex shrink-0 items-center gap-1 text-emerald-600">
                <Check className="h-4 w-4" />
                <span className="text-xs">Đạt</span>
              </span>
            ) : item.state === "FAIL" ? (
              <span className="flex shrink-0 items-center gap-1 text-rose-600">
                <X className="h-4 w-4" />
                <span className="text-xs">{reason ?? "Không đạt"}</span>
              </span>
            ) : item.isLate ? (
              <span className="flex shrink-0 items-center gap-1 text-amber-600">
                <Clock className="h-4 w-4" />
                <span className="text-xs">Trễ</span>
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 text-slate-400">
                <Circle className="h-3.5 w-3.5" />
                <span className="text-xs">Chưa làm</span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
