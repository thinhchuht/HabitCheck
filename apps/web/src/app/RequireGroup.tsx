import { Navigate, Outlet } from "react-router-dom";
import { useAppStore } from "@/store/app";

/** Redirects to /onboarding when no group is selected yet. */
export function RequireGroup() {
  const selectedGroupId = useAppStore((s) => s.selectedGroupId);

  if (!selectedGroupId) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Outlet />;
}
