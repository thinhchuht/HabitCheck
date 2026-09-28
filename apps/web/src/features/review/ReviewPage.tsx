import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { groupsApi } from "@/api/groups";
import { reviewApi } from "@/api/review";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { PROOF_FILTER_LABELS } from "@/lib/constants";
import { vnNow } from "@/lib/format";
import { useAppStore } from "@/store/app";
import { useAuthStore } from "@/store/auth";
import { useNow } from "@/lib/useNow";
import type { MemberRole, ProofStatusFilter } from "@/types/api";
import { FinalizeCountdown } from "./FinalizeCountdown";
import { ProofFeed } from "./ProofFeed";

const FILTERS: ProofStatusFilter[] = ["ALL", "REPORTED", "PENDING", "APPROVED", "REJECTED"];

export function ReviewPage() {
  const groupId = useAppStore((s) => s.selectedGroupId);
  const me = useAuthStore((s) => s.user);
  const now = useNow();

  const [date, setDate] = useState(vnNow().format("YYYY-MM-DD"));
  const [status, setStatus] = useState<ProofStatusFilter>("ALL");
  const [memberId, setMemberId] = useState<string>("");

  const { data: group } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => (groupId ? groupsApi.get(groupId) : Promise.reject(new Error("Chưa chọn nhóm"))),
    enabled: groupId != null,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["proofs", groupId, date, status, memberId],
    queryFn: () =>
      groupId
        ? reviewApi.feed(groupId, {
            date,
            status,
            userId: memberId === "" ? undefined : memberId,
          })
        : Promise.reject(new Error("Chưa chọn nhóm")),
    enabled: groupId != null,
  });

  const myRole: MemberRole =
    group?.members.find((m) => m.userId === me?.id)?.role ?? "MEMBER";
  const canModerate = myRole === "OWNER" || myRole === "ADMIN";

  const finalizeAt = data?.finalizeAt ?? null;
  const finalized = finalizeAt == null || Date.parse(finalizeAt) <= now;

  return (
    <div className="space-y-5">
      <PageHeader title="Kiểm tra bằng chứng" subtitle="Xem, báo cáo và duyệt bằng chứng check-in của nhóm.">
        <FinalizeCountdown finalizeAt={finalizeAt} />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-auto"
          aria-label="Chọn ngày"
        />

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatus(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                status === f
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {PROOF_FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
          aria-label="Lọc theo thành viên"
        >
          <option value="">Tất cả thành viên</option>
          {(group?.members ?? []).map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.displayName}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <ProofFeed
          items={data?.items ?? []}
          canModerate={canModerate}
          finalized={finalized}
          myName={me?.displayName ?? ""}
        />
      )}
    </div>
  );
}
