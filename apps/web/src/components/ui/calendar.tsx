import * as React from "react";
import { DayPicker } from "react-day-picker";
import { vi } from "react-day-picker/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Lịch do app tự vẽ (react-day-picker) — thay cho popup lịch native của OS,
 * tông màu theo bộ slate/indigo chung của app.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={vi}
      className={cn("p-3", className)}
      classNames={{
        root: "w-fit",
        months: "flex flex-col gap-4 sm:flex-row",
        month: "w-fit",
        month_caption: "relative flex h-8 items-center justify-center",
        caption_label: "text-sm font-semibold text-slate-800",
        button_previous:
          "absolute left-0 flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-30",
        button_next:
          "absolute right-0 flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-30",
        month_grid: "w-full border-collapse pt-2",
        weekdays: "flex",
        weekday: "w-9 text-center text-xs font-medium text-slate-400",
        week: "mt-1 flex w-full",
        day: "group/day relative h-9 p-0 text-center",
        day_button:
          "flex h-9 w-9 items-center justify-center rounded-lg text-sm tabular-nums text-slate-700 transition-colors hover:bg-slate-100",
        today:
          "text-indigo-600 font-semibold [&>button]:font-semibold [&>button]:text-indigo-600",
        selected:
          "[&>button]:bg-indigo-600 [&>button]:font-semibold [&>button]:text-white [&>button]:hover:bg-indigo-600",
        outside: "[&>button]:text-slate-300",
        disabled: "[&>button]:pointer-events-none [&>button]:text-slate-300",
        hidden: "[&>button]:invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
