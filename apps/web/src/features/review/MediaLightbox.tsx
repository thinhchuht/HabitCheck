import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MediaDto } from "@/types/api";

interface MediaLightboxProps {
  media: MediaDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Full-size viewer for a proof image or video. */
export function MediaLightbox({ media, open, onOpenChange }: MediaLightboxProps) {
  const showImage = media != null && (media.type === "image" || media.thumbnailUrl != null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bằng chứng</DialogTitle>
        </DialogHeader>
        {media ? (
          <div className="overflow-hidden rounded-xl bg-slate-950">
            {showImage ? (
              <img
                src={media.thumbnailUrl ?? media.url}
                alt="Bằng chứng"
                className="mx-auto max-h-[70vh] w-full object-contain"
              />
            ) : (
              <video src={media.url} controls autoPlay className="mx-auto max-h-[70vh] w-full" />
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
