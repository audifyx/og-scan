import { Navigate, Route, Routes } from "react-router-dom";
import { OsShell } from "./layout/OsShell";
import { OsLandingPage } from "./pages/OsLanding";
import { OsLoginPage } from "./pages/OsLogin";
import { OsDashboardPage } from "./pages/OsDashboard";
import {
  OsAchievementsPage,
  OsCharacterPage,
  OsInventoryPage,
  OsLobbiesPage,
  OsRewardsPage,
  OsSettingsPage,
  OsUserHubPage,
} from "./pages/OsHubPages";
import {
  OsCommunitiesPage,
  OsGamesPage,
  OsLaunchpadPage,
  OsLeaderboardsPage,
  OsPredictionsPage,
  OsScannerPage,
  OsSocialPage,
  OsTradingPage,
  OsVoicePage,
} from "./pages/OsFeaturePages";

/** OrbitX OS frontend experience — nested under /os/* */
export default function OsApp() {
  return (
    <Routes>
      <Route element={<OsShell />}>
        <Route index element={<OsLandingPage />} />
        <Route path="login" element={<OsLoginPage />} />
        <Route path="dashboard" element={<OsDashboardPage />} />
        <Route path="hub" element={<OsUserHubPage />} />
        <Route path="character" element={<OsCharacterPage />} />
        <Route path="inventory" element={<OsInventoryPage />} />
        <Route path="achievements" element={<OsAchievementsPage />} />
        <Route path="lobbies" element={<OsLobbiesPage />} />
        <Route path="rewards" element={<OsRewardsPage />} />
        <Route path="settings" element={<OsSettingsPage />} />
        <Route path="trading" element={<OsTradingPage />} />
        <Route path="scanner" element={<OsScannerPage />} />
        <Route path="launchpad" element={<OsLaunchpadPage />} />
        <Route path="games" element={<OsGamesPage />} />
        <Route path="predictions" element={<OsPredictionsPage />} />
        <Route path="social" element={<OsSocialPage />} />
        <Route path="communities" element={<OsCommunitiesPage />} />
        <Route path="voice" element={<OsVoicePage />} />
        <Route path="leaderboards" element={<OsLeaderboardsPage />} />
        <Route path="*" element={<Navigate to="/os" replace />} />
      </Route>
    </Routes>
  );
}
