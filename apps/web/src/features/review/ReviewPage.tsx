import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { groupsApi } from "@/api/groups";
import { reviewApi } from "@/api/review";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        subtitle="Xem ảnh check-in theo ngày, theo thành viên — hợp lệ ngay khi upload, không cần duyệt."
      />

      <div className="flex flex-wrap items-center gap-3">
        <DatePicker
          value={date}
          onChange={setDate}
          className="w-full sm:w-auto"
          ariaLabel="Chọn ngày"
        />

        <Select
          value={memberId || "all"}
          onValueChange={(v) => setMemberId(v === "all" ? "" : v)}
        >
          <SelectTrigger
            className="w-full sm:w-64"
            aria-label="Lọc theo thành viên"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả thành viên</SelectItem>
            {(group?.members ?? []).map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
