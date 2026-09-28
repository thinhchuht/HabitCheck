import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { groupsApi } from "@/api/groups";
import { getApiErrorMessage } from "@/api/client";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/format";
import { useAppStore } from "@/store/app";
import { useAuthStore } from "@/store/auth";
import { InviteCodeCard } from "./InviteCodeCard";
import { MemberList } from "./MemberList";
import { PenaltyTiersEditor } from "./PenaltyTiersEditor";

export function GroupPage() {
  const groupId = useAppStore((s) => s.selectedGroupId);
  const me = useAuthStore((s) => s.user);

  const { data: group, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => (groupId ? groupsApi.get(groupId) : Promise.reject(new Error("Chưa chọn nhóm"))),
    enabled: groupId != null,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !group) {
    return (
      <EmptyState
        icon={<Users className="h-7 w-7" />}
        title="Không tải được thông tin nhóm"
        description={getApiErrorMessage(error)}
        action={
          <button
            type="button"
            className="text-sm font-medium text-indigo-600 hover:underline"
            onClick={() => void refetch()}
          >
            Thử lại
          </button>
        }
      />
    );
  }

  const isOwner = me != null && group.ownerId === me.id;

  return (
    <div className="space-y-5">
      <PageHeader title="Nhóm" subtitle={`Tạo ngày ${fmtDate(group.createdAt)}`}>
        <Link to="/onboarding">
          <Button variant="outline">Đổi nhóm</Button>
        </Link>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>{group.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Mã nhóm</p>
            <p className="mt-0.5 font-mono font-semibold text-slate-800">{group.id.slice(0, 8)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Cửa sổ kiểm tra</p>
            <p className="mt-0.5 font-semibold text-slate-800">
              {group.reviewWindowHours} giờ
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Thành viên</p>
            <p className="mt-0.5 font-semibold text-slate-800">{group.members.length} người</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Chủ nhóm</p>
            <p className="mt-0.5 font-semibold text-slate-800">
              {group.members.find((m) => m.userId === group.ownerId)?.displayName ?? "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      <InviteCodeCard code={group.inviteCode} />
      <MemberList group={group} meUserId={me?.id ?? ""} />

      {isOwner ? <PenaltyTiersEditor key={group.id} group={group} /> : null}
    </div>
  );
}
