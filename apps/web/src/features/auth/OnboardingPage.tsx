import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, KeyRound, Users, UsersRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { groupAvatarClass, groupInitial } from "@/lib/group";
import { useAppStore } from "@/store/app";
import { useAuthStore } from "@/store/auth";
import type { GroupDto } from "@/types/api";

function pickGroup(group: GroupDto, navigate: (to: string) => void): void {
  useAppStore.getState().setSelectedGroupId(group.id);
  toast.success(`Đã vào nhóm "${group.name}"`);
  navigate("/today");
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const selectedGroupId = useAppStore((s) => s.selectedGroupId);

  const { data: myGroups, isLoading: loadingGroups } = useQuery({
    queryKey: ["groups", "mine"],
    queryFn: () => groupsApi.mine(),
  });

  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const name = groupName.trim();
    if (!name) {
      toast.error("Vui lòng nhập tên nhóm");
      return;
    }
    setCreating(true);
    try {
      const group = await groupsApi.create(name);
      // Danh sách nhóm trong sidebar (caches "fresh" 30s) không tự biết
      // nhóm mới → đánh dấu stale để refetch ngay khi vào app.
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      pickGroup(group, navigate);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Tạo nhóm thất bại"));
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      toast.error("Vui lòng nhập mã mời");
      return;
    }
    setJoining(true);
    try {
      const group = await groupsApi.join(code);
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      pickGroup(group, navigate);
    } catch (err) {
      toast.error(
        getApiErrorMessage(
          err,
          "Mã mời không hợp lệ hoặc bạn đã là thành viên.",
        ),
      );
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader
          title="Vào nhóm"
          subtitle="Tạo nhóm mới, nhập mã mời, hoặc chọn lại nhóm đã tham gia. Có thể tham gia nhiều nhóm — nhóm cũ giữ nguyên, không cần xoá."
        />
        <div className="space-y-6">
          {loadingGroups || (myGroups ?? []).length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  Nhóm của tôi
                </CardTitle>
                <CardDescription>
                  Chọn nhóm để tiếp tục — nhóm đã tạo/tham gia trước đó vẫn giữ
                  nguyên.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingGroups ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {(myGroups ?? []).map((g) => {
                      const isCurrent = g.id === selectedGroupId;
                      const isOwner = me != null && g.ownerId === me.id;
                      return (
                        <li
                          key={g.id}
                          className="flex items-center justify-between gap-3 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${groupAvatarClass(
                                g.id,
                              )}`}
                            >
                              {groupInitial(g.name)}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-semibold text-slate-900">
                                  {g.name}
                                </p>
                                {isOwner ? (
                                  <Badge variant="secondary">Chủ nhóm</Badge>
                                ) : null}
                              </div>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {g.members.length} thành viên
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant={isCurrent ? "outline" : "default"}
                            disabled={isCurrent}
                            onClick={() => pickGroup(g, navigate)}
                          >
                            {isCurrent ? (
                              <span className="flex items-center gap-1">
                                <Check className="h-4 w-4" />
                                Đang dùng
                              </span>
                            ) : (
                              "Vào nhóm"
                            )}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UsersRound className="h-5 w-5 text-indigo-600" />
                  Tạo nhóm mới
                </CardTitle>
                <CardDescription>
                  Bạn sẽ là chủ nhóm và có toàn quyền quản lý.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="group-name">Tên nhóm</Label>
                    <Input
                      id="group-name"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="VD: Hội quyết tâm dậy sớm"
                      maxLength={100}
                    />
                  </div>
                  <Button type="submit" disabled={creating} className="w-full">
                    {creating ? "Đang tạo…" : "Tạo nhóm"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-indigo-600" />
                  Tham gia nhóm
                </CardTitle>
                <CardDescription>
                  Nhập mã mời do chủ nhóm chia sẻ.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleJoin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-code">Mã mời</Label>
                    <Input
                      id="invite-code"
                      value={inviteCode}
                      onChange={(e) =>
                        setInviteCode(e.target.value.toUpperCase())
                      }
                      placeholder="VD: AB12CD"
                      maxLength={16}
                      className="font-mono uppercase"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={joining}
                    className="w-full"
                  >
                    {joining ? "Đang tham gia…" : "Tham gia nhóm"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
