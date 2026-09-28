import { MoreVertical, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/api/client";
import { groupsApi } from "@/api/groups";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MEMBER_ROLE_LABELS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { firstName } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import type { BadgeProps } from "@/components/ui/badge";
import type { GroupDto, MemberDto, MemberRole } from "@/types/api";

const ROLE_VARIANT: Record<MemberRole, BadgeProps["variant"]> = {
  OWNER: "default",
  ADMIN: "success",
  MEMBER: "secondary",
};

interface MemberListProps {
  group: GroupDto;
  meUserId: string;
}

export function MemberList({ group, meUserId }: MemberListProps) {
  const queryClient = useQueryClient();
  const groupId = useAppStore((s) => s.selectedGroupId);
  const isOwner = group.ownerId === meUserId;
  const [toRemove, setToRemove] = useState<MemberDto | null>(null);

  const removeMember = useMutation({
    mutationFn: (userId: string) => groupsApi.removeMember(group.id, userId),
    onSuccess: () => {
      toast.success("Đã xoá thành viên khỏi nhóm.");
      setToRemove(null);
      if (groupId) {
        void queryClient.invalidateQueries({ queryKey: ["group", groupId] });
        void queryClient.invalidateQueries({ queryKey: ["live", groupId] });
        void queryClient.invalidateQueries({ queryKey: ["fund", groupId] });
      }
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Thành viên ({group.members.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {group.members.map((m) => (
          <div
            key={m.userId}
            className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50"
          >
            <Avatar className="h-10 w-10">
              {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt={m.displayName} /> : null}
              <AvatarFallback>{firstName(m.displayName).toUpperCase().slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate font-semibold text-slate-900">{m.displayName}</p>
                {m.userId === meUserId ? <Badge variant="outline">Bạn</Badge> : null}
                <Badge variant={ROLE_VARIANT[m.role]}>{MEMBER_ROLE_LABELS[m.role]}</Badge>
              </div>
              <p className="text-xs text-slate-400">Tham gia {fmtDate(m.joinedAt)}</p>
            </div>
            {isOwner && m.userId !== meUserId ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-rose-600 focus:text-rose-700"
                    onSelect={() => setToRemove(m)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Xoá thành viên
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        ))}
      </CardContent>

      <Dialog open={toRemove != null} onOpenChange={(o) => !o && setToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xoá thành viên?</DialogTitle>
            <DialogDescription>
              {toRemove?.displayName} sẽ không còn xem được bằng chứng và bảng live của nhóm.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToRemove(null)} disabled={removeMember.isPending}>
              Đóng lại
            </Button>
            <Button
              variant="destructive"
              disabled={removeMember.isPending}
              onClick={() => toRemove && removeMember.mutate(toRemove.userId)}
            >
              {removeMember.isPending ? "Đang xoá…" : "Xoá"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
