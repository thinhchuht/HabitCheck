import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaDto } from "@/types/api";

const SIZE_CLASSES = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-full min-h-[200px] w-full",
} as const;

interface MediaThumbProps {
  media: MediaDto;
  size?: keyof typeof SIZE_CLASSES;
  onClick?: () => void;
}

/** Small thumbnail for a proof media (image, or video with a play overlay). */
export function MediaThumb({ media, size = "md", onClick }: MediaThumbProps) {
  const src = media.thumbnailUrl ?? media.url;
  const showImage = media.type === "image" || media.thumbnailUrl != null;
  return (
    <button
      type="button"
      onClick={onClick}
      title="Xem bằng chứng"
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100",
        SIZE_CLASSES[size]
      )}
    >
      {showImage ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-slate-800 text-white">
          <Play className="h-5 w-5" />
        </span>
      )}
    </button>
  );
}
