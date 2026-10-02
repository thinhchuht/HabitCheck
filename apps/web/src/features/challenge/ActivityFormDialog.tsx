import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { challengesApi } from "@/api/challenges";
import { getApiErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/store/app";
import type { ActivityDto, ActivityInput } from "@/types/api";

const activitySchema = z
  .object({
    name: z
      .string()
      .min(1, "Vui lòng nhập tên hoạt động")
      .max(100, "Tối đa 100 ký tự"),
    description: z.string().max(300, "Mô tả tối đa 300 ký tự"),
    icon: z.string().max(8, "Icon tối đa 8 ký tự"),
    unit: z.string().max(50, "Đơn vị tối đa 50 ký tự"),
    unitKind: z.enum(["TIME", "CUSTOM"]),
    type: z.enum(["DEADLINE", "DURATION", "WINDOW"]),
    deadlineTime: z.string(),
    targetMinutes: z.string(),
    windowStart: z.string(),
    windowEnd: z.string(),
  })
  .superRefine((v, ctx) => {
    // Tự chọn đơn vị: chỉ cần đơn vị — không có kiểu thời gian / tham số giờ.
    if (v.unitKind === "CUSTOM") {
      if (!v.unit.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["unit"],
          message: "Vui lòng nhập đơn vị (VD: 10000 bước, 5 km)",
        });
      }
      return;
    }

    if (v.type === "DEADLINE" && !v.deadlineTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deadlineTime"],
        message: "Vui lòng chọn giờ hạn",
      });
    }

    if (v.type === "DURATION") {
      const target = v.targetMinutes === "" ? null : Number(v.targetMinutes);
      if (target === null || !Number.isInteger(target) || target <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["targetMinutes"],
          message: "Số phút mục tiêu (số nguyên > 0)",
        });
      }
    }

    if (v.type === "WINDOW") {
      if (!v.windowStart) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["windowStart"],
          message: "Vui lòng chọn giờ bắt đầu",
        });
      }
      if (!v.windowEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["windowEnd"],
          message: "Vui lòng chọn giờ kết thúc",
        });
      }
      if (v.windowStart && v.windowEnd && v.windowEnd <= v.windowStart) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["windowEnd"],
          message: "Giờ kết thúc phải sau giờ bắt đầu",
        });
      }
    }
  });

type ActivityFormValues = z.infer<typeof activitySchema>;

function toTimeInput(v: string | null): string {
  return v ? v.slice(0, 5) : "";
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);

/** Chọn giờ theo khung 24h (00–23) + phút — giá trị "HH:mm". */
function Time24Selects({
  hourId,
  minuteId,
  value,
  onChange,
}: {
  hourId: string;
  minuteId: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const hh = value.length >= 2 ? value.slice(0, 2) : "";
  const mm = value.length >= 5 ? value.slice(3, 5) : "";
  return (
    <div className="grid grid-cols-2 gap-2">
      <Select
        value={hh || undefined}
        onValueChange={(h) => onChange(`${h}:${mm || "00"}`)}
      >
        <SelectTrigger id={hourId} aria-label="Chọn giờ">
          <SelectValue placeholder="Chọn giờ" />
        </SelectTrigger>
        <SelectContent>
          {HOURS.map((h) => (
            <SelectItem key={h} value={h}>
              {h} giờ
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={mm || undefined}
        onValueChange={(m) => onChange(`${hh || "00"}:${m}`)}
      >
        <SelectTrigger id={minuteId} aria-label="Chọn phút">
          <SelectValue placeholder="Chọn phút" />
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map((m) => (
            <SelectItem key={m} value={m}>
              {m} phút
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function toInput(v: ActivityFormValues): ActivityInput {
  const base = {
    name: v.name.trim(),
    description: v.description.trim() || null,
    icon: v.icon.trim() || null,
    // Video không còn hỗ trợ — bằng chứng check-in chỉ là ảnh.
    proofType: "PHOTO" as const,
  };
  // Tự chọn đơn vị: luôn lưu dạng DURATION (tick + 1 ảnh/ngày), không giờ.
  if (v.unitKind === "CUSTOM") {
    return { ...base, type: "DURATION", unit: v.unit.trim() };
  }
  // Kiểu thời gian → không lưu đơn vị riêng (thời gian do kiểu/tham số mang).
  if (v.type === "DEADLINE") {
    return { ...base, type: "DEADLINE", deadlineTime: v.deadlineTime };
  }
  if (v.type === "DURATION") {
    return {
      ...base,
      type: "DURATION",
      targetMinutes: v.targetMinutes === "" ? null : Number(v.targetMinutes),
    };
  }
  return {
    ...base,
    type: "WINDOW",
    windowStart: v.windowStart,
    windowEnd: v.windowEnd,
  };
}

interface ActivityFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challengeId: string;
  /** null = thêm hoạt động mới. */
  activity: ActivityDto | null;
}

export function ActivityFormDialog({
  open,
  onOpenChange,
  challengeId,
  activity,
}: ActivityFormDialogProps) {
  const queryClient = useQueryClient();
  const groupId = useAppStore((s) => s.selectedGroupId);
  const [formError, setFormError] = useState<string | null>(null);

  const isEdit = activity != null;

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      name: "",
      description: "",
      icon: "",
      unit: "",
      unitKind: "TIME",
      type: "DEADLINE",
      deadlineTime: "",
      targetMinutes: "",
      windowStart: "",
      windowEnd: "",
    },
  });

  useEffect(() => {
    if (open) {
      setFormError(null);
      reset(
        activity
          ? {
              name: activity.name,
              description: activity.description ?? "",
              icon: activity.icon ?? "",
              unit: activity.unit ?? "",
              unitKind: activity.unit ? "CUSTOM" : "TIME",
              type: activity.type,
              deadlineTime: toTimeInput(activity.deadlineTime),
              targetMinutes:
                activity.targetMinutes != null
                  ? String(activity.targetMinutes)
                  : "",
              windowStart: toTimeInput(activity.windowStart),
              windowEnd: toTimeInput(activity.windowEnd),
            }
          : {
              name: "",
              description: "",
              icon: "",
              unit: "",
              unitKind: "TIME",
              type: "DEADLINE",
              deadlineTime: "",
              targetMinutes: "",
              windowStart: "",
              windowEnd: "",
            },
      );
    }
  }, [open, activity, reset]);

  const unitKind = watch("unitKind");
  const type = watch("type");

  const mutation = useMutation({
    mutationFn: (input: ActivityInput) =>
      activity
        ? challengesApi.updateActivity(challengeId, activity.id, input)
        : challengesApi.addActivity(challengeId, input),
    onSuccess: () => {
      toast.success(isEdit ? "Đã cập nhật hoạt động." : "Đã thêm hoạt động.");
      if (groupId) {
        void queryClient.invalidateQueries({
          queryKey: ["challenges", groupId],
        });
        void queryClient.invalidateQueries({ queryKey: ["today"] });
      }
      onOpenChange(false);
    },
    onError: (err) =>
      setFormError(getApiErrorMessage(err, "Lưu không thành công")),
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(toInput(values));
  });

  const fieldError = (key: keyof ActivityFormValues) =>
    errors[key]?.message ? (
      <p className="text-xs text-rose-600">{errors[key]?.message as string}</p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Sửa hoạt động" : "Thêm hoạt động"}
          </DialogTitle>
          <DialogDescription>
            Tham số áp dụng cho tất cả các ngày của kỳ thử thách.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="act-name">Tên hoạt động *</Label>
            <Input
              id="act-name"
              placeholder="VD: Dậy sớm"
              {...register("name")}
            />
            {fieldError("name")}
          </div>

          <div className="space-y-2">
            <Label>Đơn vị</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={unitKind === "TIME" ? "default" : "outline"}
                onClick={() => setValue("unitKind", "TIME")}
              >
                ⏱ Thời gian
              </Button>
              <Button
                type="button"
                size="sm"
                variant={unitKind === "CUSTOM" ? "default" : "outline"}
                onClick={() => setValue("unitKind", "CUSTOM")}
              >
                ✏️ Tự chọn đơn vị
              </Button>
            </div>
            {unitKind === "TIME" ? (
              <p className="text-xs text-slate-400">
                Đơn vị là thời gian — tự theo kiểu thời gian bên dưới (phút cho
                thời lượng, giờ HH:mm cho giờ chính xác / khung giờ).
              </p>
            ) : (
              <>
                <Input
                  id="act-unit"
                  placeholder="VD: 10000 bước, 5 km"
                  maxLength={50}
                  {...register("unit")}
                />
                <p className="text-xs text-slate-400">
                  Không cần chọn kiểu thời gian / giờ — chấm kiểu thời lượng:
                  tick + chụp 1 ảnh trong ngày là đạt.
                </p>
                {fieldError("unit")}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div
              className={`space-y-2 ${unitKind === "CUSTOM" ? "col-span-2" : ""}`}
            >
              <Label htmlFor="act-icon">Icon (emoji)</Label>
              <Input
                id="act-icon"
                placeholder="🌅"
                maxLength={8}
                {...register("icon")}
              />
              {fieldError("icon")}
            </div>
            {unitKind === "TIME" ? (
              <div className="space-y-2">
                <Label htmlFor="act-type">Kiểu thời gian *</Label>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="act-type" aria-label="Kiểu thời gian">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DEADLINE">
                          Giờ chính xác (VD: dậy đúng 6:00)
                        </SelectItem>
                        <SelectItem value="DURATION">
                          Thời lượng (VD: thể dục 1 giờ)
                        </SelectItem>
                        <SelectItem value="WINDOW">
                          Khung giờ (WINDOW)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="act-desc">Mô tả</Label>
            <Textarea
              id="act-desc"
              rows={2}
              placeholder="Tùy chọn"
              {...register("description")}
            />
            {fieldError("description")}
          </div>

          {unitKind === "TIME" && type === "DEADLINE" ? (
            <div className="space-y-2">
              <Label htmlFor="act-deadline">Giờ hạn *</Label>
              <Controller
                name="deadlineTime"
                control={control}
                render={({ field }) => (
                  <Time24Selects
                    hourId="act-deadline"
                    minuteId="act-deadline-min"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <p className="text-xs text-slate-400">
                Chỉ nhận check-in từ 2 giờ trước đến 10 phút sau mốc giờ (VD:
                hạn 6:00 → check-in được từ 4:00 đến 6:10).
              </p>
              {fieldError("deadlineTime")}
            </div>
          ) : null}

          {unitKind === "TIME" && type === "DURATION" ? (
            <div className="space-y-2">
              <Label htmlFor="act-target">Thời lượng (phút) *</Label>
              <Input
                id="act-target"
                type="number"
                min={1}
                placeholder="60"
                {...register("targetMinutes")}
              />
              <p className="text-xs text-slate-400">
                VD: 60 = thể dục 1 giờ. Trong ngày chỉ cần tick + chụp 1 ảnh là
                đạt.
              </p>
              {fieldError("targetMinutes")}
            </div>
          ) : null}

          {unitKind === "TIME" && type === "WINDOW" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="act-win-start">Bắt đầu *</Label>
                <Controller
                  name="windowStart"
                  control={control}
                  render={({ field }) => (
                    <Time24Selects
                      hourId="act-win-start"
                      minuteId="act-win-start-min"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                {fieldError("windowStart")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="act-win-end">Kết thúc *</Label>
                <Controller
                  name="windowEnd"
                  control={control}
                  render={({ field }) => (
                    <Time24Selects
                      hourId="act-win-end"
                      minuteId="act-win-end-min"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                {fieldError("windowEnd")}
              </div>
            </div>
          ) : null}

          {formError ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Huỷ
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {isSubmitting || mutation.isPending
                ? "Đang lưu…"
                : isEdit
                  ? "Lưu thay đổi"
                  : "Thêm hoạt động"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
