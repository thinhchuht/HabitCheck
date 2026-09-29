import { Activity } from "lucide-react";
import type { TickerItem } from "@/types/api";

interface TickerProps {
  items: TickerItem[];
}

/** Latest group activity feed (newest first). Text do server định dạng sẵn. */
export function Ticker({ items }: TickerProps) {
  if (items.length === 0) return null;

  const sorted = [...items].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_0_rgba(16,24,40,0.04),0_1px_3px_0_rgba(16,24,40,0.06)]">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Activity className="h-3.5 w-3.5 text-indigo-500" />
        Hoạt động gần nhất
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {sorted.map((t) => (
          <li
            key={t.checkinId}
            className="flex items-start gap-2 text-sm text-slate-600"
          >
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
            {t.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
