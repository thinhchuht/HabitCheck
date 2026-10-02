import { Bell, LogOut, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authApi } from "@/api/auth";
import { getApiErrorMessage } from "@/api/client";
import { meApi } from "@/api/me";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { firstName } from "@/lib/utils";
import { stopRealtime } from "@/realtime/connection";
import { useAuthStore } from "@/store/auth";
import { AvatarUpload } from "./AvatarUpload";
import { ReminderSettings } from "./ReminderSettings";

export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState(user?.displayName ?? "");

  // Sync local name when the user object changes (e.g. ProfileUpdated event).
  useEffect(() => {
    if (user) setName(user.displayName);
  }, [user?.displayName]);

  const nameDirty =
    user != null && name.trim() !== user.displayName && name.trim().length > 0;

  const updateName = useMutation({
    mutationFn: () => meApi.update({ displayName: name.trim() }),
    onSuccess: (me) => {
      useAuthStore.getState().setUser(me);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Đã cập nhật tên hiển thị.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // Ignore — we clear local state anyway.
    }
    await stopRealtime();
    useAuthStore.getState().clearAuth();
    navigate("/login", { replace: true });
  }

  if (!user) return null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Hồ sơ"
        subtitle="Thông tin cá nhân, avatar và cài đặt nhắc nhở."
      >
        <Button variant="destructive" onClick={() => void handleLogout()}>
          <LogOut className="mr-1.5 h-4 w-4" />
          Đăng xuất
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-indigo-600" />
            Thông tin cá nhân
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user.displayName} />
              ) : null}
              <AvatarFallback className="text-2xl">
                {firstName(user.displayName).toUpperCase().slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">{user.displayName}</p>
              <p className="text-sm text-slate-400">{user.email}</p>
              <AvatarUpload />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-name">Tên hiển thị</Label>
            <div className="flex gap-2">
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                className="max-w-sm"
              />
              {nameDirty ? (
                <Button
                  size="sm"
                  className="h-10"
                  onClick={() => updateName.mutate()}
                  disabled={updateName.isPending}
                >
                  {updateName.isPending ? "Đang lưu…" : "Lưu"}
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-indigo-600" />
            Nhắc nhở
          </CardTitle>
          <CardDescription>
            Cài đặt thông báo cho hoạt động mỗi ngày.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReminderSettings user={user} />
        </CardContent>
      </Card>
    </div>
  );
}
