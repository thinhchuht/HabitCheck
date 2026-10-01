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
  const {
    userId,
    displayName,
    avatarUrl,
    online,
    items,
    expectedPenalty,
    isCheatDay,
  } = member;
  const isMe = userId === meUserId;
  const passedCount = items.filter((i) => i.status === "PASS").length;
  const totalCount = items.length;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-slate-50/60"
      >
        <div className="relative shrink-0">
          <Avatar className="h-11 w-11">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={displayName} />
            ) : null}
            <AvatarFallback>
              {firstName(displayName).toUpperCase().slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              "absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-white",
              online ? "bg-emerald-500" : "bg-slate-300",
            )}
            title={online ? "Đang online" : "Offline"}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate font-semibold text-slate-900">
              {displayName}
            </p>
            {isMe ? <Badge variant="outline">Bạn</Badge> : null}
            {isCheatDay ? <Badge variant="success">🎉 Cheat day</Badge> : null}
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
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded ? <ExpandableItems items={items} /> : null}
    </Card>
  );
}
