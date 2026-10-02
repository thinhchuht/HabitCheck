import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAdmin } from "@/app/RequireAdmin";
import { RequireAuth } from "@/app/RequireAuth";
import { RequireGroup } from "@/app/RequireGroup";
import { AppShell } from "@/components/AppShell";
import { LoginPage } from "@/features/auth/LoginPage";
import { OnboardingPage } from "@/features/auth/OnboardingPage";
import { AdminDashboardPage } from "@/features/admin/AdminDashboardPage";
import { AdminLayout } from "@/features/admin/AdminLayout";
import { AdminGroupsPage } from "@/features/admin/AdminGroupsPage";
import { AdminGroupDetailPage } from "@/features/admin/AdminGroupDetailPage";
import { AdminUsersPage } from "@/features/admin/AdminUsersPage";
import { AdminUserDetailPage } from "@/features/admin/AdminUserDetailPage";
import { AdminActivitiesPage } from "@/features/admin/AdminActivitiesPage";
import { AdminFundPage } from "@/features/admin/AdminFundPage";
import { AdminStatsPage } from "@/features/admin/AdminStatsPage";
import { AdminOpsPage } from "@/features/admin/AdminOpsPage";
import { TodayPage } from "@/features/today/TodayPage";
import { ChallengePage } from "@/features/challenge/ChallengePage";
import { LiveBoardPage } from "@/features/live-board/LiveBoardPage";
import { ReviewPage } from "@/features/review/ReviewPage";
import { HistoryPage } from "@/features/history/HistoryPage";
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
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="users/:id" element={<AdminUserDetailPage />} />
              <Route path="groups" element={<AdminGroupsPage />} />
              <Route path="groups/:id" element={<AdminGroupDetailPage />} />
              <Route path="activities" element={<AdminActivitiesPage />} />
              <Route path="fund" element={<AdminFundPage />} />
              <Route path="stats" element={<AdminStatsPage />} />
              <Route path="ops" element={<AdminOpsPage />} />
            </Route>
          </Route>
        </Route>

        <Route element={<RequireGroup />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<TodayPage />} />
            <Route path="/challenge" element={<ChallengePage />} />
            <Route path="/live-board" element={<LiveBoardPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/history" element={<HistoryPage />} />
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
