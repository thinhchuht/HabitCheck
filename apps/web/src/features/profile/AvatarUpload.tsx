import imageCompression from "browser-image-compression";
import { useQueryClient } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/client";
import { meApi } from "@/api/me";
import { Button } from "@/components/ui/button";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { MAX_IMAGE_BYTES } from "@/lib/constants";
import { useAppStore } from "@/store/app";
import { useAuthStore } from "@/store/auth";

export function AvatarUpload() {
  const queryClient = useQueryClient();
  const groupId = useAppStore((s) => s.selectedGroupId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(selected: File) {
    if (!selected.type.startsWith("image/")) {
      toast.error("Vui lòng chọn file ảnh.");
      return;
    }
    if (selected.size > MAX_IMAGE_BYTES) {
      toast.error("Ảnh vượt quá 10MB.");
      return;
    }
    setBusy(true);
    try {
      let file: File = selected;
      try {
        file = await imageCompression(selected, {
          maxWidthOrHeight: 1024,
          initialQuality: 0.85,
        });
      } catch {
        // keep the original file if compression fails
      }
      const intent = await meApi.avatarIntent();
      const publicId = await uploadToCloudinary(file, intent, "image");
      const me = await meApi.setAvatar(publicId);
      useAuthStore.getState().setUser(me);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      if (groupId) {
        void queryClient.invalidateQueries({ queryKey: ["group", groupId] });
        void queryClient.invalidateQueries({ queryKey: ["live", groupId] });
      }
      toast.success("Đã cập nhật ảnh đại diện.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Cập nhật ảnh đại diện thất bại."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        <Camera className="mr-1.5 h-4 w-4" />
        {busy ? "Đang cập nhật…" : "Đổi ảnh"}
      </Button>
      <p className="text-xs text-slate-400">
        Ảnh sẽ được cắt tròn, tối đa 10MB.
      </p>
    </div>
  );
}
