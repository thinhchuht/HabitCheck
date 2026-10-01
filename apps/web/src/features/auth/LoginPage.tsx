import { GoogleLogin } from "@react-oauth/google";
import { Flame } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { authApi } from "@/api/auth";
import { getApiErrorMessage } from "@/api/client";
import { groupsApi } from "@/api/groups";
import { meApi } from "@/api/me";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GOOGLE_CLIENT_ID } from "@/lib/constants";
import { isGroupExpired } from "@/lib/group";
import { useAppStore } from "@/store/app";
import { useAuthStore } from "@/store/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Already logged in (persisted session) → straight back in.
  useEffect(() => {
    if (accessToken && user) navigate("/today", { replace: true });
  }, [accessToken, user, navigate]);

  /** Chạy sau khi có access token (cả 2 luồng Google / password).
   *  Mặc định vào nhóm đầu tiên chưa hết hạn — không cần chọn thủ công. */
  async function afterLogin() {
    const me = await meApi.get();
    useAuthStore.getState().setUser(me);
    if (me.isAdmin) {
      navigate("/admin", { replace: true });
      return;
    }
    const groups = await groupsApi.mine().catch(() => null);
    // Token đã hợp lệ nhưng tải danh sách nhóm thất bại (API lỗi/mạng) —
    // không chặn người dùng ở màn hình login: onboarding tự tải lại + có nút thử lại.
    if (groups === null) {
      navigate("/onboarding", { replace: true });
      return;
    }
    const firstActive = groups.find((g) => !isGroupExpired(g));
    if (firstActive) {
      useAppStore.getState().setSelectedGroupId(firstActive.id);
      navigate("/today", { replace: true });
    } else {
      navigate("/onboarding", { replace: true });
    }
  }

  async function handleCredential(credential: string) {
    setBusy(true);
    try {
      const res = await authApi.google(credential);
      useAuthStore.getState().setAccessToken(res.accessToken);
      await afterLogin();
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, "Đăng nhập thất bại. Vui lòng thử lại."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handlePassword(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await authApi.password(username.trim(), password);
      useAuthStore.getState().setAccessToken(res.accessToken);
      await afterLogin();
    } catch (err) {
      toast.error(
        getApiErrorMessage(
          err,
          "Đăng nhập thất bại. Kiểm tra thông tin đăng nhập hoặc kết nối mạng.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const clientConfigured = GOOGLE_CLIENT_ID !== "";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-slate-50 to-white px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -bottom-32 h-80 w-80 rounded-full bg-violet-200/40 blur-3xl"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
            <Flame className="h-7 w-7" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Habit <span className="text-indigo-600">Check-in</span>
          </h1>
          <p className="text-center text-sm text-slate-500">
            Theo dõi thói quen mỗi ngày, check-in bằng ảnh/video, cùng nhóm chịu
            phạt.
          </p>
        </div>

        <Card className="border-slate-200/70 shadow-xl shadow-slate-900/5">
          <CardContent className="flex flex-col items-center gap-4 p-8">
            {busy ? (
              <p className="py-4 text-sm text-slate-500">Đang đăng nhập…</p>
            ) : (
              <>
                <GoogleLogin
                  locale="vi"
                  theme="outline"
                  size="large"
                  shape="pill"
                  width="100%"
                  onSuccess={(res) => {
                    if (res.credential) void handleCredential(res.credential);
                  }}
                  onError={() =>
                    toast.error("Google Sign-in bị lỗi. Vui lòng thử lại.")
                  }
                />
                <div className="flex w-full items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs text-slate-400">hoặc</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <form onSubmit={handlePassword} className="w-full space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-username" className="sr-only">
                      Tên đăng nhập
                    </Label>
                    <Input
                      id="login-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Tên đăng nhập"
                      autoComplete="username"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password" className="sr-only">
                      Mật khẩu
                    </Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mật khẩu"
                      autoComplete="current-password"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full"
                    disabled={username.trim() === "" || password === ""}
                  >
                    Đăng nhập bằng tài khoản
                  </Button>
                </form>
              </>
            )}
            <p className="text-center text-xs text-slate-400">
              Đăng nhập lần đầu sẽ mời bạn tạo nhóm hoặc nhập mã mời.
            </p>
          </CardContent>
        </Card>

        {!clientConfigured ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <strong>Chưa cấu hình Google Client ID</strong> — đặt biến{" "}
            <code className="rounded bg-amber-100 px-1">
              VITE_GOOGLE_CLIENT_ID
            </code>{" "}
            trong <code className="rounded bg-amber-100 px-1">.env</code> rồi
            chạy lại ứng dụng.
          </div>
        ) : null}
      </div>
    </div>
  );
}
