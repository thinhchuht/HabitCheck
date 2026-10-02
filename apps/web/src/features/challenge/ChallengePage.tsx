import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, History, Lock, Plus, Save, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { challengesApi } from "@/api/challenges";
import { getApiErrorMessage } from "@/api/client";
import { groupsApi } from "@/api/groups";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CHALLENGE_STATUS_LABELS } from "@/lib/constants";
import { fmtDate, vnNow } from "@/lib/format";
import { groupAvatarClass, groupInitial } from "@/lib/group";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import { useAuthStore } from "@/store/auth";
import type {
  ActivityDto,
  ChallengeDto,
  ChallengeStatus,
  PenaltyTiers,
} from "@/types/api";
import { ActivityFormDialog } from "./ActivityFormDialog";
import { ActivityRow } from "./ActivityRow";
import { PenaltyPreview } from "./PenaltyPreview";

function sortedActivities(challenge: ChallengeDto): ActivityDto[] {
  return [...challenge.activities].sort((a, b) => a.sortOrder - b.sortOrder);
}

function CreateForm({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();
  // Ngày bắt đầu sớm nhất là ngày mai — không nhận hôm nay hoặc quá khứ.
  const minStartDate = vnNow().add(1, "day").format("YYYY-MM-DD");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(minStartDate);
  const [endDate, setEndDate] = useState(
    vnNow().add(8, "day").format("YYYY-MM-DD"),
  );

  const mutation = useMutation({
    mutationFn: () =>
      challengesApi.create({
        groupId,
        title: title.trim(),
        startDate,
        endDate,
      }),
    onSuccess: () => {
      toast.success("Đã tạo kỳ thử thách. Thêm hoạt động bên dưới.");
      void queryClient.invalidateQueries({ queryKey: ["challenges", groupId] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Tạo kỳ thất bại")),
  });

  const invalid =
    title.trim().length === 0 ||
    startDate < minStartDate ||
    startDate > endDate;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tạo kỳ thử thách</CardTitle>
        <CardDescription>
          Mỗi kỳ là 1 bảng lịch hoạt động trong ngày (giờ chính xác hoặc thời
          lượng), lặp lại hằng ngày từ ngày bắt đầu đến ngày kết thúc. Ngày bắt
          đầu sớm nhất là ngày mai. Từ 00:00 ngày bắt đầu, toàn bộ hoạt động sẽ
          bị khoá và không thể sửa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!invalid) mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="ch-title">Tên kỳ *</Label>
            <Input
              id="ch-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Tháng 9 — quyết tâm dậy sớm"
              maxLength={100}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ch-start">Ngày bắt đầu *</Label>
              <Input
                id="ch-start"
                type="date"
                value={startDate}
                min={minStartDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-end">Ngày kết thúc *</Label>
              <Input
                id="ch-end"
                type="date"
                value={endDate}
                min={startDate || minStartDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          {startDate > endDate ? (
            <p className="text-xs text-rose-600">
              Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.
            </p>
          ) : null}
          <Button type="submit" disabled={invalid || mutation.isPending}>
            {mutation.isPending ? "Đang tạo…" : "Tạo kỳ thử thách"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function DraftSection({
  challenge,
  tiers,
}: {
  challenge: ChallengeDto;
  tiers: PenaltyTiers | undefined;
}) {
  const queryClient = useQueryClient();
  const groupId = useAppStore((s) => s.selectedGroupId);

  const [title, setTitle] = useState(challenge.title);
  const [startDate, setStartDate] = useState(challenge.startDate);
  const [endDate, setEndDate] = useState(challenge.endDate);
  const [editing, setEditing] = useState<ActivityDto | null>(null);
  const [adding, setAdding] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const dirty =
    title !== challenge.title ||
    startDate !== challenge.startDate ||
    endDate !== challenge.endDate;
  const dateInvalid = startDate > endDate;

  const invalidate = () => {
    if (groupId)
      void queryClient.invalidateQueries({ queryKey: ["challenges", groupId] });
    void queryClient.invalidateQueries({ queryKey: ["today"] });
  };

  const updateChallenge = useMutation({
    mutationFn: () =>
      challengesApi.update(challenge.id, {
        title: title.trim(),
        startDate,
        endDate,
      }),
    onSuccess: () => {
      toast.success("Đã lưu kỳ thử thách.");
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const removeChallenge = useMutation({
    mutationFn: () => challengesApi.remove(challenge.id),
    onSuccess: () => {
      toast.success("Đã huỷ kỳ thử thách.");
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const removeActivity = useMutation({
    mutationFn: (activityId: string) =>
      challengesApi.removeActivity(challenge.id, activityId),
    onSuccess: () => {
      toast.success("Đã xoá hoạt động.");
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const activities = sortedActivities(challenge);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              {challenge.title}
              <Badge variant="warning">
                🔓 Sẽ khoá lúc 00:00 {fmtDate(challenge.startDate)}
              </Badge>
            </CardTitle>
          </div>
          <CardDescription>
            Kỳ đang là bản nháp — thêm/sửa/xoá hoạt động thoải mái.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (dirty && !dateInvalid) updateChallenge.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="draft-title">Tên kỳ</Label>
              <Input
                id="draft-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="draft-start">Ngày bắt đầu</Label>
                <Input
                  id="draft-start"
                  type="date"
                  value={startDate}
                  min={vnNow().add(1, "day").format("YYYY-MM-DD")}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="draft-end">Ngày kết thúc</Label>
                <Input
                  id="draft-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            {dateInvalid ? (
              <p className="text-xs text-rose-600">
                Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.
              </p>
            ) : null}
            {dirty ? (
              <Button
                type="submit"
                size="sm"
                disabled={updateChallenge.isPending}
              >
                <Save className="mr-1.5 h-4 w-4" />
                {updateChallenge.isPending ? "Đang lưu…" : "Lưu thay đổi"}
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Bảng lịch hoạt động trong ngày ({activities.length})
            </CardTitle>
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Thêm
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {activities.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              Chưa có hoạt động nào. Nhấn “Thêm” để tạo hoạt động đầu tiên.
            </p>
          ) : (
            activities.map((a) => (
              <ActivityRow
                key={a.id}
                activity={a}
                editable
                onEdit={setEditing}
                onDelete={(act) => {
                  if (window.confirm(`Xoá hoạt động "${act.name}"?`)) {
                    removeActivity.mutate(act.id);
                  }
                }}
              />
            ))
          )}
        </CardContent>
      </Card>

      {tiers ? <PenaltyPreview tiers={tiers} /> : null}

      <div className="flex justify-end">
        <Button variant="destructive" onClick={() => setCanceling(true)}>
          Huỷ kỳ thử thách
        </Button>
      </div>

      <ActivityFormDialog
        open={adding || editing != null}
        onOpenChange={(o) => {
          setAdding(o);
          if (!o) setEditing(null);
        }}
        challengeId={challenge.id}
        activity={editing}
      />

      <Dialog open={canceling} onOpenChange={setCanceling}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Huỷ kỳ thử thách?</DialogTitle>
            <DialogDescription>
              Kỳ "{challenge.title}" sẽ bị xoá hoàn toàn cùng các hoạt động.
              Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCanceling(false)}>
              Đóng lại
            </Button>
            <Button
              variant="destructive"
              disabled={removeChallenge.isPending}
              onClick={() => removeChallenge.mutate()}
            >
              {removeChallenge.isPending ? "Đang huỷ…" : "Huỷ kỳ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const GROUP_CHALLENGE_BADGE: Record<
  ChallengeStatus,
  "success" | "warning" | "secondary" | "outline"
> = {
  ACTIVE: "success",
  DRAFT: "warning",
  COMPLETED: "secondary",
  CANCELLED: "outline",
};

/** Xem kỳ thử thách + bảng lịch hoạt động của các thành viên khác trong nhóm. */
function GroupChallengesSection({ groupId }: { groupId: string | null }) {
  const meUserId = useAuthStore((s) => s.user?.id ?? null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["challenges", groupId, "group"],
    queryFn: () => challengesApi.allInGroup(groupId!),
    enabled: groupId != null,
  });

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const others = (data ?? []).filter((c) => c.userId !== meUserId);

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-2xl" />;
  }
  if (isError) {
    return (
      <p className="text-sm text-rose-600">
        Không tải được kỳ của thành viên: {getApiErrorMessage(error)}
      </p>
    );
  }
  if (others.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Kỳ của thành viên ({others.length})
        </CardTitle>
        <CardDescription>
          Xem kỳ thử thách và bảng lịch hoạt động của các thành viên khác trong
          nhóm.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {others.map((c) => {
          const isExpanded = expanded.has(c.id);
          return (
            <div
              key={c.id}
              className="overflow-hidden rounded-xl border border-slate-200"
            >
              <button
                type="button"
                onClick={() => toggle(c.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50/60"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                    groupAvatarClass(c.userId),
                  )}
                >
                  {groupInitial(c.ownerName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-semibold text-slate-900">
                      {c.title}
                    </span>
                    <Badge variant={GROUP_CHALLENGE_BADGE[c.status]}>
                      {CHALLENGE_STATUS_LABELS[c.status]}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {c.ownerName} • {fmtDate(c.startDate)} →{" "}
                    {fmtDate(c.endDate)} • {c.activities.length} hoạt động
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-slate-400 transition-transform",
                    isExpanded && "rotate-180",
                  )}
                />
              </button>
              {isExpanded ? (
                <div className="space-y-2 border-t border-slate-100 bg-slate-50/40 px-4 py-3">
                  {c.activities.length === 0 ? (
                    <p className="py-1 text-sm text-slate-400">
                      Kỳ này chưa có hoạt động.
                    </p>
                  ) : (
                    c.activities.map((a) => (
                      <ActivityRow key={a.id} activity={a} />
                    ))
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ActiveSection({ challenge }: { challenge: ChallengeDto }) {
  const activities = sortedActivities(challenge);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {challenge.title}
          <Badge variant="success">
            {CHALLENGE_STATUS_LABELS[challenge.status]}
          </Badge>
        </CardTitle>
        <CardDescription>
          {fmtDate(challenge.startDate)} → {fmtDate(challenge.endDate)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Lock className="h-4 w-4 shrink-0" />
          Đã khoá — không thể thêm/sửa/xoá hoạt động trong kỳ đang diễn ra.
        </div>
        <div className="space-y-2">
          {activities.map((a) => (
            <ActivityRow key={a.id} activity={a} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ChallengePage() {
  const groupId = useAppStore((s) => s.selectedGroupId);

  const { data: challenges, isLoading } = useQuery({
    queryKey: ["challenges", groupId],
    queryFn: () =>
      groupId
        ? challengesApi.mine(groupId)
        : Promise.resolve([] as ChallengeDto[]),
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
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  const list = challenges ?? [];
  const draft = list.find((c) => c.status === "DRAFT");
  const active = list.find((c) => c.status === "ACTIVE");
  const history = list.filter(
    (c) => c.status === "COMPLETED" || c.status === "CANCELLED",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kỳ thử thách"
        subtitle="Định nghĩa bảng lịch hoạt động trong ngày — giờ chính xác hoặc thời lượng — kèm bằng chứng (tick + chụp ảnh) cho cả nhóm."
      />

      <GroupChallengesSection groupId={groupId} />

      {active ? <ActiveSection challenge={active} /> : null}
      {draft ? (
        <DraftSection challenge={draft} tiers={group?.penaltyTiers} />
      ) : null}
      {active == null && draft == null ? (
        <CreateForm groupId={groupId ?? ""} />
      ) : null}

      {history.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Lịch sử
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-2.5 text-sm"
              >
                <span className="font-medium text-slate-800">{c.title}</span>
                <span className="text-slate-400">
                  {fmtDate(c.startDate)} → {fmtDate(c.endDate)}
                </span>
                <Badge variant="secondary">
                  {CHALLENGE_STATUS_LABELS[c.status]}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
