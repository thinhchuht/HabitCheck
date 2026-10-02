import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Circle, X } from "lucide-react";
import { useState } from "react";
import { groupsApi } from "@/api/groups";
import { getApiErrorMessage } from "@/api/client";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { CHALLENGE_STATUS_LABELS, FAIL_REASON_LABELS } from "@/lib/constants";
import { formatVND, fmtDate, fmtTime, vn, vnNow } from "@/lib/format";
import { cn, firstName, isEmojiLike } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import { useAuthStore } from "@/store/auth";
import type {
  DailyReportActivityDto,
  DailyReportDayDto,
  DailyReportMemberDto,
  FailReason,
} from "@/types/api";

function reasonLabel(failReason: string | null): string | null {
  if (failReason == null) return null;
  return failReason in FAIL_REASON_LABELS
    ? FAIL_REASON_LABELS[failReason as FailReason]
    : failReason;
}

function ActivityRows({ items }: { items: DailyReportActivityDto[] }) {
  if (items.length === 0) {
    return (
      <p className="px-1 py-2 text-sm text-slate-400">Chưa có hoạt động nào.</p>
    );
  }
  return (
    <ul className="space-y-1 border-t border-slate-100 px-4 py-3">
      {items.map((item) => {
        const reason = reasonLabel(item.failReason);
        return (
          <li
            key={item.activityId}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2 text-slate-700">
              {isEmojiLike(item.icon) ? (
                <span className="text-base">{item.icon as string}</span>
              ) : null}
              <span className="truncate">{item.name}</span>
            </span>
            {item.passed === true ? (
              <span className="flex shrink-0 items-center gap-1 text-emerald-600">
                <Check className="h-4 w-4" />
                <span className="text-xs">
                  Đạt
                  {item.firstCheckinAt
                    ? ` (${fmtTime(item.firstCheckinAt)})`
                    : ""}
                </span>
              </span>
            ) : item.passed === false ? (
              <span className="flex shrink-0 items-center gap-1 text-rose-600">
                <X className="h-4 w-4" />
                <span className="text-xs">{reason ?? "Không đạt"}</span>
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 text-slate-400">
                <Circle className="h-3.5 w-3.5" />
                <span className="text-xs">Không chấm (cheat day)</span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function DayRow({ day }: { day: DailyReportDayDto }) {
  const [expanded, setExpanded] = useState(false);
  const hasChallenge = day.challenge != null;

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-slate-50/60"
      >
        <span className="w-24 shrink-0 font-medium text-slate-700">
          {vn(day.date).format("dd/MM (ddd)")}
        </span>
        {day.isCheatDay ? <Badge variant="success">🎉 Cheat</Badge> : null}
        <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
          {hasChallenge
            ? `${day.challenge!.title} · ${CHALLENGE_STATUS_LABELS[day.challenge!.status]}`
            : "Không có kỳ"}
        </span>
        {hasChallenge ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <Badge variant={day.failedCount > 0 ? "danger" : "success"}>
              {day.passedCount}/{day.totalActivities}
            </Badge>
            {day.resultStatus === "FINAL" ? (
              <Badge variant="secondary">Chốt</Badge>
            ) : day.resultStatus === "PROVISIONAL" ? (
              <Badge variant="secondary">Tạm</Badge>
            ) : null}
            {day.penalty > 0 ? (
              <span className="w-20 text-right font-medium text-rose-600">
                {formatVND(day.penalty)}
              </span>
            ) : (
              <span className="w-20 text-right text-slate-300">0đ</span>
            )}
          </span>
        ) : (
          <span className="w-20 shrink-0 text-right text-slate-300">—</span>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>
      {expanded && hasChallenge ? (
        <div className="border-t border-slate-100">
          <ActivityRows items={day.activities} />
        </div>
      ) : null}
    </>
  );
}

function MemberRow({
  member,
  meUserId,
}: {
  member: DailyReportMemberDto;
  meUserId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isMe = member.userId === meUserId;
  const challengeDays = member.days.filter((d) => d.challenge != null).length;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-slate-50/60"
      >
        <Avatar className="h-11 w-11 shrink-0">
          {member.avatarUrl ? (
            <AvatarImage src={member.avatarUrl} alt={member.displayName} />
          ) : null}
          <AvatarFallback>
            {firstName(member.displayName).toUpperCase().slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate font-semibold text-slate-900">
              {member.displayName}
            </p>
            {isMe ? <Badge variant="outline">Bạn</Badge> : null}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {member.noFailDays}/{challengeDays} ngày không fail
          </p>
        </div>
        <Badge variant={member.totalPenalty > 0 ? "danger" : "success"}>
          {formatVND(member.totalPenalty)}
        </Badge>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-slate-400 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded ? (
        <div className="space-y-0.5 border-t border-slate-100 px-2 py-2">
          {member.days.map((day) => (
            <DayRow key={day.date} day={day} />
          ))}
        </div>
      ) : null}
    </Card>
  );
}

/** Lịch sử từng ngày của nhóm: lọc khoảng ngày → ai làm gì, cheat day, phạt bao nhiêu. */
export function HistoryPage() {
  const groupId = useAppStore((s) => s.selectedGroupId);
  const meUserId = useAuthStore((s) => s.user?.id ?? null);
  const today = vnNow().format("YYYY-MM-DD");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["daily-report", groupId, from, to],
    queryFn: () =>
      groupId
        ? groupsApi.dailyReport(groupId, from, to)
        : Promise.reject(new Error("Chưa chọn nhóm")),
    enabled: groupId != null && from <= to,
  });

  const presets: { label: string; apply: () => void }[] = [
    {
      label: "Hôm nay",
      apply: () => {
        setFrom(today);
        setTo(today);
      },
    },
    {
      label: "7 ngày",
      apply: () => {
        setFrom(vnNow().subtract(6, "day").format("YYYY-MM-DD"));
        setTo(today);
      },
    },
    {
      label: "30 ngày",
      apply: () => {
        setFrom(vnNow().subtract(29, "day").format("YYYY-MM-DD"));
        setTo(today);
      },
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lịch sử nhóm"
        subtitle={`Từ ${fmtDate(from)} đến ${fmtDate(to)}`}
      >
        {data ? (
          <Badge variant={data.totalPenalty > 0 ? "danger" : "success"}>
            Tổng phạt: {formatVND(data.totalPenalty)}
          </Badge>
        ) : null}
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:items-end">
        <div className="space-y-1.5">
          <label
            htmlFor="history-from"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Từ
          </label>
          <DatePicker
            id="history-from"
            value={from}
            max={to}
            onChange={(v) => setFrom(v <= to ? v : to)}
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="history-to"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Đến
          </label>
          <DatePicker
            id="history-to"
            value={to}
            min={from}
            max={today}
            onChange={(v) => setTo(v >= from ? v : from)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={p.apply}
              className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <Card>
          <div className="space-y-2 p-6 text-center">
            <p className="text-sm text-slate-500">
              {getApiErrorMessage(error)}
            </p>
            <button
              type="button"
              className="text-sm font-medium text-indigo-600 hover:underline"
              onClick={() => void refetch()}
            >
              Thử lại
            </button>
          </div>
        </Card>
      ) : null}

      {data ? (
        <div className="space-y-2">
          {data.members.map((m) => (
            <MemberRow key={m.userId} member={m} meUserId={meUserId} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
