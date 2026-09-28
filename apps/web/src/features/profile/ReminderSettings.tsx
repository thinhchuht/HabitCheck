import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/client";
import { meApi } from "@/api/me";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/store/auth";
import type { UserDto } from "@/types/api";

const AHEAD_OPTIONS = [
  { value: "0", label: "Không nhắc" },
  { value: "5", label: "Trước hạn 5 phút" },
  { value: "10", label: "Trước hạn 10 phút" },
  { value: "15", label: "Trước hạn 15 phút" },
  { value: "30", label: "Trước hạn 30 phút" },
] as const;

interface ReminderSettingsProps {
  user: UserDto;
}

export function ReminderSettings({ user }: ReminderSettingsProps) {
  const queryClient = useQueryClient();
  const [ahead, setAhead] = useState("0");
  const [endOfDay, setEndOfDay] = useState(false);

  // Keep local state in sync when the user object changes.
  useEffect(() => {
    setAhead(String(user.reminder.deadlineAheadMinutes ?? 0));
    setEndOfDay(user.reminder.endOfDayReminder);
  }, [user.reminder.deadlineAheadMinutes, user.reminder.endOfDayReminder]);

  const dirty =
    String(user.reminder.deadlineAheadMinutes ?? 0) !== ahead ||
    user.reminder.endOfDayReminder !== endOfDay;

  const save = useMutation({
    mutationFn: () =>
      meApi.update({
        reminder: {
          deadlineAheadMinutes: ahead === "0" ? null : Number(ahead),
          endOfDayReminder: endOfDay,
        },
      }),
    onSuccess: (me) => {
      useAuthStore.getState().setUser(me);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Đã lưu cài đặt nhắc nhở.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="rem-ahead">Nhắc trước hạn (hoạt động mốc giờ)</Label>
        <select
          id="rem-ahead"
          value={ahead}
          onChange={(e) => setAhead(e.target.value)}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
        >
          {AHEAD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-800">Nhắc cuối ngày</p>
          <p className="text-xs text-slate-400">
            Nhắc nếu hoạt động thời lượng chưa đủ trước khi hết ngày.
          </p>
        </div>
        <Switch checked={endOfDay} onCheckedChange={setEndOfDay} />
      </div>

      {dirty ? (
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Đang lưu…" : "Lưu cài đặt"}
        </Button>
      ) : null}
    </div>
  );
}
