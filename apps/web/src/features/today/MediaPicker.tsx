import { Camera } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

interface MediaPickerProps {
  disabled?: boolean;
  /** Object URL of the selected file (for preview). */
  previewUrl: string | null;
  onFileSelected: (file: File) => void;
  onClear: () => void;
}

/**
 * Ảnh picker ưu tiên camera máy ảnh sau trên mobile (capture="environment").
 * Video không còn hỗ trợ — bằng chứng check-in chỉ là ảnh.
 */
export function MediaPicker({
  disabled = false,
  previewUrl,
  onFileSelected,
  onClear,
}: MediaPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelected(file);
          e.target.value = "";
        }}
      />

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
            onClick={onClear}
            disabled={disabled}
          >
            Chọn lại
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-slate-500 transition-colors hover:border-indigo-400 hover:text-indigo-600 disabled:pointer-events-none disabled:opacity-50"
        >
          <Camera className="h-8 w-8" />
          <span className="text-sm font-medium">Chụp hoặc chọn ảnh</span>
          <span className="text-xs text-slate-400">
            Trên điện thoại sẽ mở thẳng camera sau
          </span>
        </button>
      )}
    </div>
  );
}
