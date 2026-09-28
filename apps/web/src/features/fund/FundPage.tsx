import { Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fundApi } from "@/api/fund";
import { groupsApi } from "@/api/groups";
import { getApiErrorMessage } from "@/api/client";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/store/app";
import { useAuthStore } from "@/store/auth";
import { DebtTable } from "./DebtTable";
import { FundSummary } from "./FundSummary";
import { HistoryTable } from "./HistoryTable";
import { RecordPaymentDialog } from "./RecordPaymentDialog";

export function FundPage() {
  const groupId = useAppStore((s) => s.selectedGroupId);
  const me = useAuthStore((s) => s.user);

  const {
    data: fund,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["fund", groupId],
    queryFn: () =>
      groupId
        ? fundApi.get(groupId)
        : Promise.reject(new Error("Chưa chọn nhóm")),
    enabled: groupId != null,
  });

  const { data: group } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () =>
      groupId
        ? groupsApi.get(groupId)
        : Promise.reject(new Error("Chưa chọn nhóm")),
    enabled: groupId != null,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !fund) {
    return (
      <EmptyState
        icon={<Wallet className="h-7 w-7" />}
        title="Không tải được quỹ phạt"
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

  const isOwner = group != null && me != null && group.ownerId === me.id;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quỹ phạt"
        subtitle="Tổng quỹ, số dư nợ và lịch sử đóng tiền của nhóm."
      >
        {isOwner ? (
          <RecordPaymentDialog
            groupId={fund.groupId}
            members={group?.members ?? []}
          />
        ) : null}
      </PageHeader>

      <FundSummary fund={fund} />
      <DebtTable debts={fund.debts} />
      <HistoryTable history={fund.history} />
    </div>
  );
}
