import axios from "axios";
import { Loader2 } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { API_URL } from "@/lib/constants";
import { useAuthStore } from "@/store/auth";
import type { UserDto } from "@/types/api";

/** Response của POST /auth/refresh (AuthResponse phía server). */
interface RefreshResponse {
  user: UserDto;
  accessToken: string;
  accessExpiresIn: number;
}

type RestoreResult = "authenticated" | "anonymous";

// Cold start của Render free tier có thể mất tới ~1 phút — không kết luận
// "không đăng nhập" quá sớm, tránh đá user ra login oan.
const RESTORE_TIMEOUT_MS = 90_000;

/**
 * Khôi phục phiên khi tải/trải lại trang (F5, mở tab mới):
 * 1. Access token (persisted) còn sống → GET /me làm mới thông tin user.
 * 2. Token hết hạn hoặc không có → POST /auth/refresh dùng cookie
 *    `hc_refresh` (HttpOnly, SameSite=Strict — vẫn gửi được vì web và API
 *    cùng site *.onrender.com; dev local là same-origin qua proxy).
 *
 * Single-flight: an toàn với double-mount của React StrictMode.
 * Dùng axios "trần" (không qua interceptor của api/client) để không bị
 * vòng lặp refresh→401→clearAuth trong lúc khởi động.
 */
let restorePromise: Promise<RestoreResult> | null = null;

function restoreSession(): Promise<RestoreResult> {
  restorePromise ??= (async () => {
    const { accessToken } = useAuthStore.getState();

    if (accessToken) {
      try {
        const me = await axios.get<UserDto>(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: RESTORE_TIMEOUT_MS,
        });
        useAuthStore.getState().setUser(me.data);
        return "authenticated";
      } catch {
        // Token hết hạn (hoặc lỗi mạng) → thử cookie refresh bên dưới.
      }
    }

    try {
      const res = await axios.post<RefreshResponse>(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true, timeout: RESTORE_TIMEOUT_MS },
      );
      useAuthStore.getState().setAuth(res.data.accessToken, res.data.user);
      return "authenticated";
    } catch {
      // Không tự đăng xuất: nếu vẫn còn phiên lưu sẵn (token cũ) thì giữ
      // nguyên — interceptor ở các request sau sẽ thử refresh lại, VD khi
      // API đang cold start. Chỉ về trang login khi thật sự không có phiên.
      return useAuthStore.getState().accessToken
        ? "authenticated"
        : "anonymous";
    }
  })();
  return restorePromise;
}

/**
 * Chặn render router cho tới khi phiên đã được xác nhận, để RequireAuth
 * không đá về /login trong lúc localStorage/refresh chưa kịp khôi phục.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void restoreSession().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-sm text-slate-500">Đang tải…</p>
      </div>
    );
  }

  return <>{children}</>;
}
