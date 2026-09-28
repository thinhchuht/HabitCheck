import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "@/app/RequireAuth";
import { RequireGroup } from "@/app/RequireGroup";
import { AppShell } from "@/components/AppShell";
import { LoginPage } from "@/features/auth/LoginPage";
import { OnboardingPage } from "@/features/auth/OnboardingPage";
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
