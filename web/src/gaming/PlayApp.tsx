import { Navigate, Route, Routes } from "react-router-dom";
import { PlayShell } from "./ui/PlayShell";
import { PlayHomePage } from "./ui/pages/PlayHome";
import { PlayCharacterPage } from "./ui/pages/PlayCharacter";
import { PlayBattlePassPage, PlayProgressionPage } from "./ui/pages/PlayProgression";
import { PlayInventoryPage } from "./ui/pages/PlayInventory";
import { PlayMultiplayerPage } from "./ui/pages/PlayMultiplayer";
import { PlayHudPage } from "./ui/pages/PlayHud";

/** OrbitX Gaming Studio — /play/* */
export default function PlayApp() {
  return (
    <Routes>
      <Route element={<PlayShell />}>
        <Route index element={<PlayHomePage />} />
        <Route path="character" element={<PlayCharacterPage />} />
        <Route path="progression" element={<PlayProgressionPage />} />
        <Route path="inventory" element={<PlayInventoryPage />} />
        <Route path="multiplayer" element={<PlayMultiplayerPage />} />
        <Route path="hud" element={<PlayHudPage />} />
        <Route path="pass" element={<PlayBattlePassPage />} />
        <Route path="*" element={<Navigate to="/play" replace />} />
      </Route>
    </Routes>
  );
}
