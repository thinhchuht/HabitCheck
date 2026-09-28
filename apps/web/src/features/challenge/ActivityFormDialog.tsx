import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
    type: z.enum(["DEADLINE", "DURATION", "WINDOW"]),
    deadlineTime: z.string(),
    graceMinutes: z.string(),
    targetMinutes: z.string(),
    windowStart: z.string(),
    windowEnd: z.string(),
    proofType: z.enum(["PHOTO", "VIDEO", "ANY"]),
    overridePenalty: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.graceMinutes !== "") {
      const grace = Number(v.graceMinutes);
      if (!Number.isInteger(grace) || grace < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["graceMinutes"],
          message: "Số nguyên ≥ 0",
        });
      }
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

    if (v.overridePenalty !== "") {
      const op = Number(v.overridePenalty);
      if (!Number.isInteger(op) || op < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["overridePenalty"],
          message: "Số tiền phạt riêng (số nguyên ≥ 0, VND)",
        });
      }
    }
  });

type ActivityFormValues = z.infer<typeof activitySchema>;

function toTimeInput(v: string | null): string {
  return v ? v.slice(0, 5) : "";
}

function toInput(v: ActivityFormValues): ActivityInput {
  const input: ActivityInput = {
    name: v.name.trim(),
    description: v.description.trim() || null,
    icon: v.icon.trim() || null,
    type: v.type,
    proofType: v.proofType,
    overridePenalty:
      v.overridePenalty === "" ? null : Number(v.overridePenalty),
  };
  if (v.type === "DEADLINE") {
    input.deadlineTime = v.deadlineTime;
    input.graceMinutes = v.graceMinutes === "" ? 0 : Number(v.graceMinutes);
  } else if (v.type === "DURATION") {
    input.targetMinutes =
      v.targetMinutes === "" ? null : Number(v.targetMinutes);
  } else {
    input.windowStart = v.windowStart;
    input.windowEnd = v.windowEnd;
  }
  return input;
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
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      name: "",
      description: "",
      icon: "",
      type: "DEADLINE",
      deadlineTime: "",
      graceMinutes: "",
      targetMinutes: "",
      windowStart: "",
      windowEnd: "",
      proofType: "ANY",
      overridePenalty: "",
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
              type: activity.type,
              deadlineTime: toTimeInput(activity.deadlineTime),
              graceMinutes: activity.graceMinutes
                ? String(activity.graceMinutes)
                : "",
              targetMinutes:
                activity.targetMinutes != null
                  ? String(activity.targetMinutes)
                  : "",
              windowStart: toTimeInput(activity.windowStart),
              windowEnd: toTimeInput(activity.windowEnd),
              proofType: activity.proofType,
              overridePenalty:
                activity.overridePenalty != null
                  ? String(activity.overridePenalty)
                  : "",
            }
          : {
              name: "",
              description: "",
              icon: "",
              type: "DEADLINE",
              deadlineTime: "",
              graceMinutes: "",
              targetMinutes: "",
              windowStart: "",
              windowEnd: "",
              proofType: "ANY",
              overridePenalty: "",
            },
      );
    }
  }, [open, activity, reset]);

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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="act-icon">Icon (emoji)</Label>
              <Input
                id="act-icon"
                placeholder="🌅"
                maxLength={8}
                {...register("icon")}
              />
              {fieldError("icon")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-type">Kiểu thời gian *</Label>
              <select
                id="act-type"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                {...register("type")}
              >
                <option value="DEADLINE">
                  Giờ chính xác (VD: dậy đúng 6:00)
                </option>
                <option value="DURATION">Thời lượng (VD: thể dục 1 giờ)</option>
                <option value="WINDOW">Khung giờ (WINDOW)</option>
              </select>
            </div>
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

          {type === "DEADLINE" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="act-deadline">Giờ hạn *</Label>
                <Input
                  id="act-deadline"
                  type="time"
                  {...register("deadlineTime")}
                />
                {fieldError("deadlineTime")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="act-grace">Chậm thêm (phút)</Label>
                <Input
                  id="act-grace"
                  type="number"
                  min={0}
                  placeholder="0"
                  {...register("graceMinutes")}
                />
                {fieldError("graceMinutes")}
              </div>
            </div>
          ) : null}

          {type === "DURATION" ? (
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
                VD: 60 = thể dục 1 giờ. Trong ngày chỉ cần tick + chụp 1
                ảnh/video là đạt.
              </p>
              {fieldError("targetMinutes")}
            </div>
          ) : null}

          {type === "WINDOW" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="act-win-start">Bắt đầu *</Label>
                <Input
                  id="act-win-start"
                  type="time"
                  {...register("windowStart")}
                />
                {fieldError("windowStart")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="act-win-end">Kết thúc *</Label>
                <Input
                  id="act-win-end"
                  type="time"
                  {...register("windowEnd")}
                />
                {fieldError("windowEnd")}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="act-proof">Loại bằng chứng *</Label>
              <select
                id="act-proof"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                {...register("proofType")}
              >
                <option value="ANY">Ảnh hoặc video</option>
                <option value="PHOTO">Chỉ ảnh</option>
                <option value="VIDEO">Chỉ video</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-override">Phạt riêng (VND)</Label>
              <Input
                id="act-override"
                type="number"
                min={0}
                placeholder="Trống = theo bậc"
                {...register("overridePenalty")}
              />
              {fieldError("overridePenalty")}
            </div>
          </div>

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
