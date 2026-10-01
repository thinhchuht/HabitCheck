import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ACTIVITY_TYPE_LABELS,
  CHALLENGE_STATUS_LABELS,
} from "@/lib/constants";
import { fmtDate, formatVND } from "@/lib/format";
import { isEmojiLike } from "@/lib/utils";
import { activitySummary } from "@/features/challenge/ActivityRow";
import type { AdminChallengeStats } from "@/types/api";

/**
 * Một kỳ thử thách + số liệu chốt ngày (dùng chung cho trang chi tiết
 * user admin và chi tiết nhóm admin). Bấm tiêu đề để xem/ẩn danh sách hoạt động.
 */
export function ChallengeStatsCard({ item }: { item: AdminChallengeStats }) {
  const [open, setOpen] = useState(false);
  const c = item.challenge;

  return (
    <Card className="border-slate-200/80">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{c.title}</p>
            <Badge variant="secondary">
              {CHALLENGE_STATUS_LABELS[c.status]}
            </Badge>
            <span className="text-xs text-slate-400">
              {fmtDate(c.startDate)} → {fmtDate(c.endDate)}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Đã chốt {item.settledDays} ngày · fail {item.failedDays} ngày ·{" "}
            <span
              className={
                item.totalPenaltyVnd > 0
                  ? "font-semibold text-rose-600"
                  : "font-semibold text-emerald-600"
              }
            >
              {formatVND(item.totalPenaltyVnd)}
            </span>
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        )}
      </button>
      {open ? (
        <CardContent className="border-t border-slate-100 pt-3">
          {c.activities.length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có hoạt động.</p>
          ) : (
            <ul className="space-y-2">
              {c.activities.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-base">
                    {isEmojiLike(a.icon) ? (
                      (a.icon as string)
                    ) : (
                      <Clock className="h-4 w-4 text-indigo-500" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-medium text-slate-800">
                        {a.name}
                      </p>
                      <Badge variant="outline">
                        {ACTIVITY_TYPE_LABELS[a.type]}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {activitySummary(a)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
