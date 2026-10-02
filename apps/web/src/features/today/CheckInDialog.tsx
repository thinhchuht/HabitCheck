import imageCompression from "browser-image-compression";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { checkinsApi } from "@/api/checkins";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_IMAGE_BYTES } from "@/lib/constants";
import { useAppStore } from "@/store/app";
import type { ActivityDto, UploadKind } from "@/types/api";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { MediaPicker } from "./MediaPicker";

interface CheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: ActivityDto;
  kind: UploadKind;
  /** Required when kind = "CHECKOUT": id of the open session to close. */
  openCheckinId?: string | null;
}

/**
 * Shared proof dialog for check-in (any type) and check-out (DURATION):
 * pick media → validate → upload intent → upload to Cloudinary → submit.
 */
export function CheckInDialog({
  open,
  onOpenChange,
  activity,
  kind,
  openCheckinId = null,
}: CheckInDialogProps) {
  const queryClient = useQueryClient();
  const groupId = useAppStore((s) => s.selectedGroupId);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset everything each time the dialog opens.
  useEffect(() => {
    if (open) {
      setFile(null);
      setPreviewUrl(null);
      setNote("");
      setError(null);
    }
  }, [open]);

  // Revoke the preview object URL when it changes / on unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const isCheckout = kind === "CHECKOUT";

  // Video không còn hỗ trợ — bằng chứng check-in chỉ là ảnh.
  async function handleFileSelected(selected: File) {
    setError(null);

    if (!selected.type.startsWith("image/")) {
      setError("Chỉ chấp nhận bằng chứng là ảnh.");
      return;
    }

    if (selected.size > MAX_IMAGE_BYTES) {
      setError("Ảnh vượt quá 10MB.");
      return;
    }
    try {
      const compressed = await imageCompression(selected, {
        maxWidthOrHeight: 1600,
        initialQuality: 0.8,
      });
      setFile(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
    } catch {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Vui lòng chọn ảnh");
      const intent = await checkinsApi.createUploadIntent({
        activityId: activity.id,
        kind,
      });
      const publicId = await uploadToCloudinary(file, intent, "image");
      if (isCheckout) {
        if (!openCheckinId) throw new Error("Thiếu phiên đang mở");
        return checkinsApi.checkout(openCheckinId, {
          intentId: intent.intentId,
          publicId,
        });
      }
      return checkinsApi.create({
        activityId: activity.id,
        intentId: intent.intentId,
        publicId,
        note: note.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success(
        isCheckout ? "Đã kết thúc phiên." : "Đã check-in thành công.",
      );
      void queryClient.invalidateQueries({ queryKey: ["today"] });
      if (groupId) {
        void queryClient.invalidateQueries({ queryKey: ["live", groupId] });
        void queryClient.invalidateQueries({ queryKey: ["proofs", groupId] });
      }
      onOpenChange(false);
    },
    onError: (err) => {
      setError(
        getApiErrorMessage(err, "Gửi không thành công. Vui lòng thử lại."),
      );
    },
  });

  function handleSubmit() {
    if (!file) {
      setError("Vui lòng chụp hoặc chọn ảnh trước khi gửi.");
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {isCheckout ? "Kết thúc phiên" : "Check-in"} {activity.name}
          </DialogTitle>
          <DialogDescription>
            {isCheckout
              ? "Gửi bằng chứng để chốt phiên — thời lượng được tính từ lúc bắt đầu."
              : "Giờ check-in lấy theo đồng hồ máy chủ tại thời điểm xin upload."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <MediaPicker
            previewUrl={previewUrl}
            disabled={mutation.isPending}
            onFileSelected={(f) => void handleFileSelected(f)}
            onClear={() => {
              setFile(null);
              setPreviewUrl(null);
              setError(null);
            }}
          />

          <div className="space-y-2">
            <Label htmlFor="checkin-note">Ghi chú (tuỳ chọn)</Label>
            <Textarea
              id="checkin-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Đã đánh răng 2 phút…"
              rows={2}
              maxLength={300}
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending
              ? "Đang gửi…"
              : isCheckout
                ? "Kết thúc phiên"
                : "Gửi check-in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
