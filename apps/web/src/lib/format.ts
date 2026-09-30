import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/vi";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { TZ } from "./constants";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("vi");

export type { Dayjs };

/** Dayjs in the fixed Vietnam timezone (default: now). */
export function vn(value?: string | number | Date | null): Dayjs {
  if (value == null) return dayjs().tz(TZ);
  return dayjs.utc(value).tz(TZ);
}

/** Today in Vietnam time. */
export function vnNow(): Dayjs {
  return dayjs().tz(TZ);
}

/** Parse a "YYYY-MM-DD" date string as a VN-local midnight. */
export function vnDate(date: string): Dayjs {
  return dayjs(`${date}T00:00:00`).tz(TZ);
}

/** Format an integer VND amount: 20000 -> "20.000đ". */
export function formatVND(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")}đ`;
}

/** "25/09/2026" */
export function fmtDate(value?: string | number | null): string {
  return vn(value).format("DD/MM/YYYY");
}

/** "25/09" */
export function fmtDateShort(value?: string | number | null): string {
  return vn(value).format("DD/MM");
}

/** "06:00" */
export function fmtTime(value?: string | number | null): string {
  return vn(value).format("HH:mm");
}

/** "06:00:30" */
export function fmtTimeSec(value?: string | number | null): string {
  return vn(value).format("HH:mm:ss");
}

/** "06:00" — cho chuỗi time-only từ API ("12:00:00" / "12:00"), không phải datetime. */
export function fmtTimeOnly(value?: string | null): string {
  if (value == null) return "…";
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return value;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** "25/09 18:05" */
export function fmtDateTime(value?: string | number | null): string {
  return vn(value).format("DD/MM HH:mm");
}

/** "Thứ Sáu, 25/09/2026" (Vietnamese day name). */
export function fmtDayLong(value?: string | number | null): string {
  return vn(value).format("dddd, DD/MM/YYYY");
}

/** Convert a date string to the <input type="date"> format "YYYY-MM-DD". */
export function toDateInput(value: string | number | null | undefined): string {
  return vn(value).format("YYYY-MM-DD");
}

/** Format a duration in ms as "HH:MM:SS" (floored, clamped at 0). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Countdown to a target epoch-ms; returns "00:00:00" once passed. */
export function formatCountdown(targetMs: number, nowMs: number): string {
  return targetMs - nowMs <= 0 ? "00:00:00" : formatClock(targetMs - nowMs);
}

/** Human duration in Vietnamese: 90 -> "1 giờ 30 phút", 45 -> "45 phút". */
export function formatMinutesVN(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 phút";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}
