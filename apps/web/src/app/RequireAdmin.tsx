import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/auth";

/** Chỉ cho vào khu /admin khi user hiện tại có quyền quản trị. */
export function RequireAdmin() {
  const user = useAuthStore((s) => s.user);

  if (!user?.isAdmin) {
    return <Navigate to="/today" replace />;
  }
  return <Outlet />;
}
