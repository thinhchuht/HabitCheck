import { Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { fmtTime } from "@/lib/format";
import { isEmojiLike } from "@/lib/utils";
import type { PersonalStatsByActivity } from "@/types/api";

interface ByActivityTableProps {
  rows: PersonalStatsByActivity[];
}

export function ByActivityTable({ rows }: ByActivityTableProps) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-400">
        Chưa có dữ liệu hoạt động.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-4">Hoạt động</th>
            <th className="w-40 py-2 pr-4">Hoàn thành</th>
            <th className="py-2 pr-4">Trung bình</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.activityId}
              className="border-b border-slate-100 last:border-0"
            >
              <td className="py-3 pr-4">
                <span className="flex items-center gap-2 font-medium text-slate-800">
                  <span className="text-base">
                    {isEmojiLike(r.icon) ? (
                      (r.icon as string)
                    ) : (
                      <Clock className="h-4 w-4 text-indigo-500" />
                    )}
                  </span>
                  {r.name}
                </span>
              </td>
              <td className="py-3 pr-4">
                <span className="flex items-center gap-2">
                  <Progress
                    value={Math.round(r.completionRate * 100)}
                    className="h-2 flex-1"
                  />
                  <span className="w-10 text-right text-xs font-semibold text-slate-600">
                    {Math.round(r.completionRate * 100)}%
                  </span>
                </span>
              </td>
              <td className="py-3 pr-4 text-slate-600">
                {r.avgCheckinTime
                  ? `check-in ${fmtTime(r.avgCheckinTime)}`
                  : r.avgMinutes != null
                    ? `${r.avgMinutes} phút`
                    : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
