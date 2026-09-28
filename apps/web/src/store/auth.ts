import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserDto } from "@/types/api";

interface AuthState {
  accessToken: string | null;
  user: UserDto | null;
  setAccessToken: (token: string) => void;
  setUser: (user: UserDto) => void;
  setAuth: (accessToken: string, user: UserDto) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setAccessToken: (accessToken) => set({ accessToken }),
      setUser: (user) => set({ user }),
      setAuth: (accessToken, user) => set({ accessToken, user }),
      clearAuth: () => set({ accessToken: null, user: null }),
    }),
    { name: "hc-auth" }
  )
);
