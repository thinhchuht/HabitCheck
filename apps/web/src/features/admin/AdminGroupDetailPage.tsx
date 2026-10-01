import { AlertTriangle, ArrowLeft, UsersRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { adminApi } from "@/api/admin";
import { getApiErrorMessage } from "@/api/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate, formatVND } from "@/lib/format";
import { firstName } from "@/lib/utils";
import { ChallengeStatsCard } from "@/features/admin/ChallengeStatsCard";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Chủ nhóm",
  ADMIN: "Quản trị",
  MEMBER: "Thành viên",
};

export function AdminGroupDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "group", id],
    queryFn: () => adminApi.group(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-7 w-7" />}
        title="Không tải được thông tin nhóm"
        description={getApiErrorMessage(error)}
        action={
          <Button variant="outline" onClick={() => void refetch()}>
            Thử lại
          </Button>
        }
      />
    );
  }

  const g = data.group;
  const tiers = g.penaltyTiers.tiers ?? [];

  return (
    <div>
      <Link
        to="/admin/groups"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Danh sách nhóm
      </Link>
      <PageHeader
        title={g.name}
        subtitle={`Tạo ${fmtDate(g.createdAt)} · mã mời ${g.inviteCode} · cửa sổ xem lại ${g.reviewWindowHours}h`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200/80 lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UsersRound className="h-5 w-5 text-indigo-500" />
              Thành viên ({g.members.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {g.members.map((m) => (
                <li key={m.userId} className="flex items-center gap-3 py-2.5">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={m.avatarUrl ?? undefined} alt={m.displayName} />
                    <AvatarFallback>
                      {firstName(m.displayName).toUpperCase().slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {m.displayName}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      vào nhóm {fmtDate(m.joinedAt)}
                    </p>
                  </div>
                  <Badge variant={m.role === "OWNER" ? "success" : "secondary"}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </Badge>
                </li>
              ))}
            </ul>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                Bảng phạt của nhóm
              </p>
              <ul className="space-y-1 text-sm">
                {tiers.map((amount, i) => (
                  <li key={i} className="flex justify-between text-slate-600">
                    <span>
                      {i === 0
                        ? "Không fail"
                        : `${i} hoạt động fail trong ngày`}
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatVND(amount)}
                    </span>
                  </li>
                ))}
                <li className="flex justify-between text-slate-600">
                  <span>Mỗi hoạt động fail thêm (sau bậc {tiers.length - 1})</span>
                  <span className="font-medium tabular-nums">
                    +{formatVND(g.penaltyTiers.extraPerActivity)}
                  </span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card className="border-slate-200/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Kỳ thử thách ({data.challenges.length})
              </CardTitle>
              <CardDescription>
                Bấm vào một kỳ để xem danh sách hoạt động của kỳ đó.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.challenges.length === 0 ? (
                <p className="text-sm text-slate-400">Nhóm chưa có kỳ thử thách nào.</p>
              ) : (
                <div className="space-y-3">
                  {data.challenges.map((item) => (
                    <ChallengeStatsCard key={item.challenge.id} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
