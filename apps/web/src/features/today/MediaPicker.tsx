import { Camera, ImageIcon, SwitchCamera } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MediaPickerProps {
  disabled?: boolean;
  /** Object URL of the selected file (for preview). */
  previewUrl: string | null;
  onFileSelected: (file: File) => void;
  onClear: () => void;
}

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Trình duyệt đã chặn quyền camera. Hãy cho phép camera cho trang này, hoặc chọn ảnh có sẵn.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Không tìm thấy camera trên thiết bị. Bạn có thể chọn ảnh có sẵn.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "Camera đang được ứng dụng khác dùng. Đóng app đó rồi thử lại, hoặc chọn ảnh có sẵn.";
  }
  if (!window.isSecureContext) {
    return "Camera chỉ hoạt động trên HTTPS (hoặc localhost). Hãy chọn ảnh có sẵn, hoặc mở lại trang bằng địa chỉ an toàn.";
  }
  return "Không mở được camera. Hãy cho phép quyền camera hoặc chọn ảnh có sẵn.";
}

function FilePickLabel({
  capture,
  disabled,
  onChange,
  children,
}: {
  capture?: "environment";
  disabled?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        buttonVariants({ variant: "outline" }),
        "relative w-full cursor-pointer overflow-hidden",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <input
        type="file"
        accept="image/*"
        capture={capture}
        disabled={disabled}
        onChange={onChange}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
      {children}
    </label>
  );
}

function isLikelyMobile() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
}

/**
 * Chụp bằng camera trong dialog (getUserMedia) — không phụ thuộc input file
 * `capture`, vốn hay bị Radix Dialog nuốt trên mobile. Có thêm chọn ảnh thư viện.
 */
export function MediaPicker({
  disabled = false,
  previewUrl,
  onFileSelected,
  onClear,
}: MediaPickerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [starting, setStarting] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  useEffect(() => {
    return () => stopTracks(streamRef.current);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {
      setCamError("Không phát được hình camera. Thử lại hoặc chọn ảnh có sẵn.");
    });
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  async function startCamera(nextFacing: "environment" | "user" = facing) {
    if (disabled) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError(
        "Trình duyệt không hỗ trợ camera. Hãy chọn ảnh có sẵn từ thư viện.",
      );
      return;
    }
    setStarting(true);
    setCamError(null);
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: nextFacing },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      });
      stopTracks(streamRef.current);
      streamRef.current = next;
      setFacing(nextFacing);
      setStream(next);
    } catch (err) {
      setCamError(cameraErrorMessage(err));
    } finally {
      setStarting(false);
    }
  }

  function closeCamera() {
    stopTracks(streamRef.current);
    streamRef.current = null;
    setStream(null);
  }

  function handleClear() {
    closeCamera();
    setCamError(null);
    onClear();
  }

  async function captureStill() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setCamError("Camera chưa sẵn sàng. Đợi hình hiện rồi chụp lại.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCamError("Không chụp được khung hình. Hãy thử chọn ảnh có sẵn.");
      return;
    }
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) {
      setCamError("Không tạo được ảnh. Hãy thử lại.");
      return;
    }
    closeCamera();
    onFileSelected(
      new File([blob], `checkin-${Date.now()}.jpg`, { type: "image/jpeg" }),
    );
  }

  function onGalleryChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      closeCamera();
      onFileSelected(file);
    }
    e.target.value = "";
  }

  return (
    <div className="space-y-3" data-media-picker="">
      {previewUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          <img
            src={previewUrl}
            alt="Xem trước"
            className="mx-auto max-h-64 w-full object-contain"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute right-2 top-2"
            onClick={handleClear}
            disabled={disabled}
          >
            Chọn lại
          </Button>
        </div>
      ) : stream ? (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="mx-auto max-h-72 w-full object-cover"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="flex-1"
              onClick={() => void captureStill()}
              disabled={disabled || starting}
            >
              <Camera className="h-4 w-4" />
              Chụp ảnh
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void startCamera(facing === "environment" ? "user" : "environment")
              }
              disabled={disabled || starting}
              aria-label="Đổi camera trước/sau"
            >
              <SwitchCamera className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={closeCamera}
              disabled={disabled}
            >
              Huỷ
            </Button>
          </div>
          <FilePickLabel disabled={disabled} onChange={onGalleryChange}>
            <ImageIcon className="h-4 w-4" />
            Chọn ảnh có sẵn
          </FilePickLabel>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            disabled={disabled || starting}
            onClick={() => void startCamera()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-slate-500 transition-colors hover:border-indigo-400 hover:text-indigo-600 disabled:pointer-events-none disabled:opacity-50"
          >
            <Camera className="h-8 w-8" />
            <span className="text-sm font-medium">
              {starting ? "Đang mở camera…" : "Mở camera để chụp"}
            </span>
            <span className="text-xs text-slate-400">
              Dùng camera máy (camera sau nếu có)
            </span>
          </button>
          {isLikelyMobile() ? (
            <FilePickLabel
              capture="environment"
              disabled={disabled}
              onChange={onGalleryChange}
            >
              <Camera className="h-4 w-4" />
              Camera hệ thống
            </FilePickLabel>
          ) : null}
          <FilePickLabel disabled={disabled} onChange={onGalleryChange}>
            <ImageIcon className="h-4 w-4" />
            Chọn ảnh có sẵn
          </FilePickLabel>
        </div>
      )}

      {camError && !previewUrl ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {camError}
        </p>
      ) : null}
    </div>
  );
}
