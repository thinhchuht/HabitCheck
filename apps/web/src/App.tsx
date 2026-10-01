import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAdmin } from "@/app/RequireAdmin";
import { RequireAuth } from "@/app/RequireAuth";
import { RequireGroup } from "@/app/RequireGroup";
import { AppShell } from "@/components/AppShell";
import { LoginPage } from "@/features/auth/LoginPage";
import { OnboardingPage } from "@/features/auth/OnboardingPage";
import { AdminDashboardPage } from "@/features/admin/AdminDashboardPage";
import { AdminGroupsPage } from "@/features/admin/AdminGroupsPage";
import { AdminGroupDetailPage } from "@/features/admin/AdminGroupDetailPage";
import { AdminUsersPage } from "@/features/admin/AdminUsersPage";
import { AdminUserDetailPage } from "@/features/admin/AdminUserDetailPage";
import { TodayPage } from "@/features/today/TodayPage";
import { ChallengePage } from "@/features/challenge/ChallengePage";
import { LiveBoardPage } from "@/features/live-board/LiveBoardPage";
import { ReviewPage } from "@/features/review/ReviewPage";
import { StatsPage } from "@/features/stats/StatsPage";
import { FundPage } from "@/features/fund/FundPage";
import { GroupPage } from "@/features/group/GroupPage";
import { ProfilePage } from "@/features/profile/ProfilePage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<OnboardingPage />} />

        <Route element={<RequireAdmin />}>
          <Route element={<AppShell />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
            <Route path="/admin/groups" element={<AdminGroupsPage />} />
            <Route
              path="/admin/groups/:id"
              element={<AdminGroupDetailPage />}
            />
          </Route>
        </Route>

        <Route element={<RequireGroup />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<TodayPage />} />
            <Route path="/challenge" element={<ChallengePage />} />
            <Route path="/live-board" element={<LiveBoardPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/fund" element={<FundPage />} />
            <Route path="/group" element={<GroupPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
