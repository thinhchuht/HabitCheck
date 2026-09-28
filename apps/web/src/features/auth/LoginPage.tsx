import { GoogleLogin } from "@react-oauth/google";
import { Flame } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { authApi } from "@/api/auth";
import { getApiErrorMessage } from "@/api/client";
import { groupsApi } from "@/api/groups";
import { meApi } from "@/api/me";
import { Card, CardContent } from "@/components/ui/card";
import { GOOGLE_CLIENT_ID } from "@/lib/constants";
import { useAppStore } from "@/store/app";
import { useAuthStore } from "@/store/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState(false);

  // Already logged in (persisted session) → straight back in.
  useEffect(() => {
    if (accessToken && user) navigate("/today", { replace: true });
  }, [accessToken, user, navigate]);

  async function handleCredential(credential: string) {
    setBusy(true);
    try {
      const res = await authApi.google(credential);
      useAuthStore.getState().setAccessToken(res.accessToken);
      const me = await meApi.get();
      useAuthStore.getState().setUser(me);

      const storedGroupId = useAppStore.getState().selectedGroupId;
      if (storedGroupId) {
        try {
          await groupsApi.get(storedGroupId);
          navigate("/today", { replace: true });
          return;
        } catch {
          useAppStore.getState().setSelectedGroupId(null);
        }
      }
      navigate("/onboarding", { replace: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Đăng nhập thất bại. Vui lòng thử lại."));
    } finally {
      setBusy(false);
    }
  }

  const clientConfigured = GOOGLE_CLIENT_ID !== "";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg">
            <Flame className="h-7 w-7" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Habit <span className="text-indigo-600">Check-in</span>
          </h1>
          <p className="text-center text-sm text-slate-500">
            Theo dõi thói quen mỗi ngày, check-in bằng ảnh/video, cùng nhóm chịu phạt.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8">
            {busy ? (
              <p className="py-4 text-sm text-slate-500">Đang đăng nhập…</p>
            ) : (
              <GoogleLogin
                locale="vi"
                theme="outline"
                size="large"
                shape="pill"
                width="100%"
                onSuccess={(res) => {
                  if (res.credential) void handleCredential(res.credential);
                }}
                onError={() => toast.error("Google Sign-in bị lỗi. Vui lòng thử lại.")}
              />
            )}
            <p className="text-center text-xs text-slate-400">
              Đăng nhập lần đầu sẽ mời bạn tạo nhóm hoặc nhập mã mời.
            </p>
          </CardContent>
        </Card>

        {!clientConfigured ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <strong>Chưa cấu hình Google Client ID</strong> — đặt biến{" "}
            <code className="rounded bg-amber-100 px-1">VITE_GOOGLE_CLIENT_ID</code> trong{" "}
            <code className="rounded bg-amber-100 px-1">.env</code> rồi chạy lại ứng dụng.
          </div>
        ) : null}
      </div>
    </div>
  );
}
