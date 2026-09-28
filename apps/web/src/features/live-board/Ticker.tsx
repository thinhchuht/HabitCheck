import { fmtTime } from "@/lib/format";
import type { TickerItem } from "@/types/api";

interface TickerProps {
  items: TickerItem[];
}

/** Latest group activity feed (newest first). */
export function Ticker({ items }: TickerProps) {
  if (items.length === 0) return null;

  const sorted = [...items]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 8);

  return (
    <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Hoạt động gần nhất
      </p>
      <ul className="space-y-1">
        {sorted.map((t, i) => (
          <li key={`${t.userId}-${t.at}-${i}`} className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">{t.displayName}</span>{" "}
            {t.action === "CHECKIN" ? "vừa check-in" : "vừa kết thúc phiên"}{" "}
            <span className="font-medium text-indigo-600">“{t.activityName}”</span> lúc{" "}
            {fmtTime(t.at)}
          </li>
        ))}
      </ul>
    </div>
  );
}
