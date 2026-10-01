import { Check, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { checkinsApi } from "@/api/checkins";
import { groupsApi } from "@/api/groups";
import { Skeleton } from "@/components/ui/skeleton";
import { groupAvatarClass, groupInitial } from "@/lib/group";
import { useAppStore } from "@/store/app";

/**
 * Filter nhóm ở sidebar: danh sách mọi nhóm user tham gia kèm số việc
 * chưa làm hôm nay của từng nhóm. Click để chuyển nhóm đang dùng —
 * mọi trang (Hôm nay, Bảng live, Kiểm tra, …) theo dõi nhóm được chọn.
 *
 * Danh sách nhóm (1 query nhẹ) render ngay; số việc chờ (N query /today)
 * tải song song, không chặn danh sách. Event SignalR đã invalidate cả 2
 * cache khi có check-in mới — polling 5 phút chỉ là an toàn dự phòng.
 */
export function GroupSwitcher() {
  const selectedGroupId = useAppStore((s) => s.selectedGroupId);
  const setSelectedGroupId = useAppStore((s) => s.setSelectedGroupId);

  const groupsQuery = useQuery({
    queryKey: ["groups", "mine-pending"],
    queryFn: () => groupsApi.mine(),
    refetchInterval: 5 * 60_000,
  });

  const groups = groupsQuery.data ?? [];

  const countsQuery = useQuery({
    queryKey: ["groups", "pending-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const list = groupsQuery.data ?? [];
      const entries = await Promise.all(
        list.map(async (g): Promise<[string, number]> => {
          try {
            const today = await checkinsApi.today(g.id);
            return [
              g.id,
              today.items.filter((i) => i.state === "PENDING").length,
            ];
          } catch {
            // Không có challenge active trong nhóm / lỗi API → không đếm.
            return [g.id, 0];
          }
        }),
      );
      return Object.fromEntries(entries);
    },
    enabled: groups.length > 0,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  const counts = countsQuery.data ?? {};

  function pick(id: string, name: string): void {
    if (id === selectedGroupId) return;
    setSelectedGroupId(id);
    toast.success(`Đã chuyển sang nhóm "${name}"`);
  }

  if (groupsQuery.isLoading) {
    return (
      <div className="pt-4">
        <Skeleton className="mb-2 h-3.5 w-24" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="mt-1 h-9 w-full" />
      </div>
    );
  }

  return (
    <div className="pt-4">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Nhóm của tôi
        </p>
        <Link
          to="/onboarding"
          className="text-[11px] font-medium text-indigo-600 hover:underline"
        >
          Đổi nhóm
        </Link>
      </div>
      {groups.length === 0 ? (
        <p className="px-1 text-xs text-slate-400">
          Chưa tham gia nhóm nào —{" "}
          <Link
            to="/onboarding"
            className="font-medium text-indigo-600 hover:underline"
          >
            vào đây tạo/tham gia
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-1">
          {groups.map((g) => {
            const isCurrent = g.id === selectedGroupId;
            const pending = counts[g.id];
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => pick(g.id, g.name)}
                  title={
                    pending != null
                      ? pending > 0
                        ? `${g.name}: còn ${pending} việc chưa làm hôm nay`
                        : `${g.name}: hoàn thành tất cả`
                      : g.name
                  }
                  className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors ${
                    isCurrent
                      ? "bg-indigo-50 font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${groupAvatarClass(
                      g.id,
                    )}`}
                  >
                    {groupInitial(g.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{g.name}</span>
                  {countsQuery.isLoading ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-300" />
                  ) : pending != null && pending > 0 ? (
                    <span
                      className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold leading-none tabular-nums text-amber-700"
                      aria-label={`${pending} việc chưa làm`}
                    >
                      {pending}
                    </span>
                  ) : (
                    <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {groupsQuery.isError ? (
        <button
          type="button"
          onClick={() => void groupsQuery.refetch()}
          className="mt-1 px-1 text-xs text-rose-500 hover:underline"
        >
          Tải danh sách không thành công — bấm để thử lại
        </button>
      ) : null}
    </div>
  );
}
