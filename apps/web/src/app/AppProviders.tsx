import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import axios from "axios";
import { useState, type ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { getApiErrorMessage } from "@/api/client";
import { GOOGLE_CLIENT_ID } from "@/lib/constants";
import { useAuthStore } from "@/store/auth";

/** React Query + Google OAuth + toasts for the whole app. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
        // Mọi lỗi tải dữ liệu (query) đều toast thông báo chính xác từ server.
        queryCache: new QueryCache({
          onError: (error) => {
            if (
              axios.isAxiosError(error) &&
              error.response?.status === 401 &&
              !useAuthStore.getState().accessToken
            ) {
              return; // phiên hết hạn: interceptor đã toast + chuyển trang login
            }
            toast.error(getApiErrorMessage(error));
          },
        }),
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <GoogleOAuthProvider
        clientId={
          GOOGLE_CLIENT_ID || "not-configured.apps.googleusercontent.com"
        }
      >
        <Toaster richColors position="top-right" />
        {children}
      </GoogleOAuthProvider>
    </QueryClientProvider>
  );
}
