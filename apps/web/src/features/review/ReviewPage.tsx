import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { groupsApi } from "@/api/groups";
import { reviewApi } from "@/api/review";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { vnNow } from "@/lib/format";
import { useAppStore } from "@/store/app";
import { ProofFeed } from "./ProofFeed";

export function ReviewPage() {
  const groupId = useAppStore((s) => s.selectedGroupId);

  const [date, setDate] = useState(vnNow().format("YYYY-MM-DD"));
  const [memberId, setMemberId] = useState<string>("");

  const { data: group } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () =>
      groupId
        ? groupsApi.get(groupId)
        : Promise.reject(new Error("Chưa chọn nhóm")),
    enabled: groupId != null,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["proofs", groupId, date, memberId],
    queryFn: () =>
      groupId
        ? reviewApi.feed(groupId, {
            date,
            userId: memberId === "" ? undefined : memberId,
          })
        : Promise.reject(new Error("Chưa chọn nhóm")),
    enabled: groupId != null,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bằng chứng check-in"
        subtitle="Ảnh/video mọi thành viên check-in — hợp lệ ngay khi upload, không cần duyệt."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-auto"
          aria-label="Chọn ngày"
        />

        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm transition-colors focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
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
        <ProofFeed items={data?.items ?? []} />
      )}
    </div>
  );
}
