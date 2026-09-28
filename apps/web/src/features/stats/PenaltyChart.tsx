import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatVND, fmtDate, fmtDateShort } from "@/lib/format";
import type { PersonalStatsByDay } from "@/types/api";

interface PenaltyChartProps {
  byDay: PersonalStatsByDay[];
}

export function PenaltyChart({ byDay }: PenaltyChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={byDay} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => fmtDateShort(v)}
            fontSize={12}
            tick={{ fill: "#64748b" }}
          />
          <YAxis
            yAxisId="penalty"
            tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
            fontSize={12}
            tick={{ fill: "#64748b" }}
          />
          <YAxis
            yAxisId="passed"
            orientation="right"
            allowDecimals={false}
            fontSize={12}
            tick={{ fill: "#64748b" }}
          />
          <Tooltip
            labelFormatter={(label) => fmtDate(label as string)}
            formatter={(value, name) =>
              name === "Phạt"
                ? [formatVND(Number(value)), name]
                : [String(value), String(name)]
            }
          />
          <Legend />
          <Bar yAxisId="penalty" dataKey="penalty" name="Phạt" fill="#fda4af" radius={[4, 4, 0, 0]} />
          <Line
            yAxisId="passed"
            type="monotone"
            dataKey="passed"
            name="Hoạt động đạt"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
