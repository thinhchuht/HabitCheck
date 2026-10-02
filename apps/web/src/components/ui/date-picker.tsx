import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { type Matcher } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { fmtDate } from "@/lib/format";

function toLocalDate(value: string): Date | undefined {
  const [y, m, d] = value.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
}

function toYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface DatePickerProps {
  id?: string;
  /** Giá trị dạng "YYYY-MM-DD" (rỗng = chưa chọn). */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  /** Class cho ô trigger (mặc định w-full — truyền w-auto/w-44... để khống chế). */
  className?: string;
  ariaLabel?: string;
}

/**
 * Chọn ngày bằng lịch tự vẽ (Popover + Calendar) — mặt trigger đồng bộ với
 * Input (h-11, rounded-lg, focus ring indigo), thay cho <input type="date">
 * native có popup do OS vẽ.
 */
export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  placeholder = "Chọn ngày",
  className,
  ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? toLocalDate(value) : undefined;

  // react-day-picker v10 bỏ minDate/maxDate → dùng matcher `disabled`.
  // { before } loại trừ ngày trước min (min vẫn chọn được); { after } loại trừ
  // ngày sau max (max vẫn chọn được) — đúng ngữ cảnh min/max hai đầu đều tính.
  const disabled: Matcher[] = [];
  const minDate = min ? toLocalDate(min) : undefined;
  const maxDate = max ? toLocalDate(max) : undefined;
  if (minDate) disabled.push({ before: minDate });
  if (maxDate) disabled.push({ after: maxDate });

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          className={cn(
            "flex h-11 w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus-visible:border-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30",
            className,
          )}
        >
          <span className={cn("truncate", !value && "text-slate-400")}>
            {value ? fmtDate(value) : placeholder}
          </span>
          <CalendarIcon className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 w-fit rounded-xl border border-slate-200 bg-white shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
        >
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            disabled={disabled.length > 0 ? disabled : undefined}
            onSelect={(d) => {
              if (d) {
                onChange(toYmd(d));
                setOpen(false);
              }
            }}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
