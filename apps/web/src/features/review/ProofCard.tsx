import { Clock } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ACTIVITY_TYPE_LABELS, CHECKIN_STATUS_LABELS } from "@/lib/constants";
import { formatMinutesVN, fmtDateTime, fmtTime } from "@/lib/format";
import { firstName, isEmojiLike } from "@/lib/utils";
import type { ProofFeedItemDto } from "@/types/api";
import { MediaLightbox } from "./MediaLightbox";

interface ProofCardProps {
  item: ProofFeedItemDto;
}

export function ProofCard({ item }: ProofCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { checkin, user, activity, challenge } = item;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <Button
            variant="ghost"
            className="h-24 w-36 shrink-0 cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-0"
            onClick={() => setLightboxOpen(true)}
          >
            {checkin.checkinMedia.type === "image" ||
            checkin.checkinMedia.thumbnailUrl != null ? (
              <img
                src={
                  checkin.checkinMedia.thumbnailUrl ?? checkin.checkinMedia.url
                }
                alt="Bằng chứng"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl">
                🎬
              </span>
            )}
          </Button>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Avatar className="h-7 w-7">
                {user.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                ) : null}
                <AvatarFallback>
                  {firstName(user.displayName).toUpperCase().slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <span className="font-semibold text-slate-900">
                {user.displayName}
              </span>
              <Badge variant="outline">
                {isEmojiLike(activity.icon) ? (activity.icon as string) : "•"}{" "}
                {activity.name}
              </Badge>
              <Badge variant="secondary">
                {ACTIVITY_TYPE_LABELS[activity.type]}
              </Badge>
              <Badge variant="secondary">
                {CHECKIN_STATUS_LABELS[checkin.status]}
              </Badge>
            </div>

            <p className="text-xs text-slate-400">Kỳ: {challenge.title}</p>

            <p className="text-sm text-slate-600">
              Giờ check-in (server):{" "}
              <span className="font-medium text-slate-900">
                {fmtTime(checkin.checkinAt)}
              </span>
              {checkin.checkoutAt ? (
                <>
                  {" "}
                  • Checkout:{" "}
                  <span className="font-medium text-slate-900">
                    {fmtTime(checkin.checkoutAt)}
                  </span>
                </>
              ) : null}
              {checkin.durationMinutes != null ? (
                <> • {formatMinutesVN(checkin.durationMinutes)}</>
              ) : null}
            </p>
            <p className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="h-3 w-3" />
              Trên hệ thống lúc {fmtDateTime(checkin.createdAt)}
            </p>

            {checkin.note ? (
              <p className="text-sm italic text-slate-500">“{checkin.note}”</p>
            ) : null}
          </div>
        </div>
      </CardContent>

      <MediaLightbox
        media={checkin.checkinMedia}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </Card>
  );
}
