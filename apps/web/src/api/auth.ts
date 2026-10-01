import { api } from "./client";
import type { GoogleLoginResponse } from "@/types/api";

export const authApi = {
  /** POST /auth/google — exchange a Google ID token for our JWT. */
  google(idToken: string): Promise<GoogleLoginResponse> {
    return api
      .post<GoogleLoginResponse>("/auth/google", { idToken })
      .then((r) => r.data);
  },

  /** POST /auth/password — đăng nhập bằng tên/mật khẩu (tài khoản admin). */
  password(username: string, password: string): Promise<GoogleLoginResponse> {
    return api
      .post<GoogleLoginResponse>("/auth/password", { username, password })
      .then((r) => r.data);
  },

  /** POST /auth/refresh — rotate the refresh cookie, get a new access token. */
  refresh(): Promise<GoogleLoginResponse> {
    return api.post<GoogleLoginResponse>("/auth/refresh").then((r) => r.data);
  },

  /** POST /auth/logout — revoke the refresh cookie. */
  async logout(): Promise<void> {
    await api.post("/auth/logout");
  },
};
