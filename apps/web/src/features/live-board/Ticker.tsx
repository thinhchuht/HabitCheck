import type { TickerItem } from "@/types/api";

interface TickerProps {
  items: TickerItem[];
}

/** Latest group activity feed (newest first). Text do server định dạng sẵn. */
export function Ticker({ items }: TickerProps) {
  if (items.length === 0) return null;

  const sorted = [...items].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8);

  return (
    <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Hoạt động gần nhất
      </p>
      <ul className="space-y-1">
        {sorted.map((t) => (
          <li key={t.checkinId} className="text-sm text-slate-600">
            {t.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
