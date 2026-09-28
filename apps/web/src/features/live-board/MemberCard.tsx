import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatVND } from "@/lib/format";
import { cn, firstName } from "@/lib/utils";
import type { LiveMemberDto } from "@/types/api";
import { ExpandableItems } from "./ExpandableItems";

interface MemberCardProps {
  member: LiveMemberDto;
  meUserId: string | null;
}

export function MemberCard({ member, meUserId }: MemberCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { user, items, passedCount, totalCount, expectedPenalty } = member;
  const isMe = user.userId === meUserId;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="relative shrink-0">
          <Avatar className="h-11 w-11">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.displayName} />
            ) : null}
            <AvatarFallback>{firstName(user.displayName).toUpperCase().slice(0, 1)}</AvatarFallback>
          </Avatar>
          <span
            className={cn(
              "absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-white",
              user.online ? "bg-emerald-500" : "bg-slate-300"
            )}
            title={user.online ? "Đang online" : "Offline"}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate font-semibold text-slate-900">{user.displayName}</p>
            {isMe ? <Badge variant="outline">Bạn</Badge> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">
              {passedCount}/{totalCount} đạt
            </Badge>
            <Badge variant={expectedPenalty > 0 ? "danger" : "success"}>
              {formatVND(expectedPenalty)}
            </Badge>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-slate-400 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded ? <ExpandableItems items={items} /> : null}
    </Card>
  );
}
