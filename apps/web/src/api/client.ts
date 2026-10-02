import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";
import { useAuthStore } from "@/store/auth";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Attach the current access token to every request.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/** Single-flight refresh: concurrent 401s share one refresh call. */
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  try {
    const res = await axios.post<{ accessToken: string }>(
      `${API_URL}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    useAuthStore.getState().setAccessToken(res.data.accessToken);
    return true;
  } catch {
    return false;
  }
}

// On 401 (expired JWT) refresh once and retry the original request.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const isAuthPath = config?.url?.startsWith("/auth/") ?? false;

    if (status === 401 && config && !config._retry && !isAuthPath) {
      config._retry = true;
      refreshPromise ??= tryRefreshToken().finally(() => {
        refreshPromise = null;
      });
      const refreshed = await refreshPromise;
      if (refreshed) {
        return api.request(config);
      }
      // Không tự đăng xuất: giữ nguyên phiên, chỉ để request này lỗi.
      // Các request sau sẽ thử refresh lại — phiên tự hồi khi server/cookie
      // bình thường. Chỉ đăng xuất khi user bấm nút hoặc bị admin chặn (403).
    }

    // 403 do tài khoản bị admin chặn (BannedUserMiddleware / RefreshTokenHandler).
    if (status === 403) {
      const data = (error.response?.data ?? null) as ProblemDetails | null;
      const banned =
        data?.detail?.includes("chặn") ??
        data?.type?.includes("banned") ??
        false;
      if (banned) {
        useAuthStore.getState().clearAuth();
        toast.error(data?.detail ?? "Tài khoản của bạn đã bị chặn.");
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  },
);

/** RFC 7807 ProblemDetails as returned by the API (contract §0). */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
}

/** Extract a human (Vietnamese) message from an API error. */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Web lỏ đừng nghịch dại, có chi nhắn tin Thịnh Chù + chụp ảnh vì sao",
): string {
  if (axios.isAxiosError(error)) {
    const data = (error.response?.data ?? null) as ProblemDetails | null;
    if (data) {
      const fieldMessages = data.errors
        ? Object.values(data.errors).flat().join(" ")
        : "";
      if (fieldMessages) return fieldMessages;
      if (data.detail) return data.detail;
      if (data.title) return data.title;
    }
    if (error.code === "ERR_NETWORK") {
      return "Không thể kết nối máy chủ. Hãy kiểm tra kết nối mạng.";
    }
    return fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
