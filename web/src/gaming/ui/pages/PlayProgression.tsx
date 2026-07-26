import { ACHIEVEMENTS, BATTLE_PASS_SEASON, DAILY_MISSIONS, WEEKLY_MISSIONS } from "../../catalogs/progressionCatalog";
import { claimBattlePassTier } from "../../systems/progression";
import { claimMission } from "../../state/GameProfileStore";
import { useGameProfile } from "../../state/useGameProfile";

export function PlayProgressionPage() {
  const { profile, xp, updateProfile } = useGameProfile();
  const { progression: prog } = profile;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div>
        <div className="gx-kicker">Player progression</div>
        <h1 className="gx-title" style={{ fontSize: "1.7rem" }}>
          Rank & missions
        </h1>
      </div>

      <div className="gx-panel">
        <div className="gx-stat">
          <span>Level {xp.level} · {prog.title}</span>
          <span>{prog.xp.toLocaleString()} XP</span>
        </div>
        <div className="gx-bar" style={{ ["--pct" as string]: `${xp.pct}%` }}><i /></div>
        <div className="gx-stat" style={{ marginTop: "0.75rem" }}>
          <span>Shards</span>
          <span>{prog.shards}</span>
        </div>
      </div>

      <div className="gx-panel">
        <div className="gx-kicker">Daily missions</div>
        <div className="gx-list" style={{ marginTop: "0.65rem" }}>
          {DAILY_MISSIONS.map((m) => {
            const st = prog.missionProgress[m.id];
            return (
              <div key={m.id} className="gx-row">
                <div>
                  <strong style={{ fontFamily: "var(--gx-display)", fontSize: "0.8rem" }}>{m.title}</strong>
                  <div style={{ color: "var(--gx-muted)", fontSize: "0.75rem" }}>{m.description}</div>
                  <div className="gx-badge" style={{ marginTop: 6 }}>{st?.status ?? "active"}</div>
                </div>
                <button
                  type="button"
                  className="gx-btn gx-btn-primary"
                  style={{ padding: "0.4rem 0.75rem" }}
                  disabled={st?.status !== "completed"}
                  onClick={() => updateProfile((p) => claimMission(p, m.id))}
                >
                  +{m.xp} XP
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="gx-panel">
        <div className="gx-kicker">Weekly</div>
        <div className="gx-list" style={{ marginTop: "0.65rem" }}>
          {WEEKLY_MISSIONS.map((m) => (
            <div key={m.id} className="gx-row">
              <div>
                <strong style={{ fontFamily: "var(--gx-display)", fontSize: "0.8rem" }}>{m.title}</strong>
                <div style={{ color: "var(--gx-muted)", fontSize: "0.75rem" }}>{m.description}</div>
              </div>
              <span className="gx-badge">+{m.shardReward} shards</span>
            </div>
          ))}
        </div>
      </div>

      <div className="gx-panel">
        <div className="gx-kicker">Achievements</div>
        <div className="gx-list" style={{ marginTop: "0.65rem" }}>
          {ACHIEVEMENTS.map((a) => {
            const unlocked = prog.unlockedAchievements.includes(a.id);
            return (
              <div key={a.id} className="gx-row" style={{ opacity: unlocked ? 1 : 0.55 }}>
                <div>
                  <strong style={{ fontFamily: "var(--gx-display)", fontSize: "0.8rem" }}>{a.name}</strong>
                  <div style={{ color: "var(--gx-muted)", fontSize: "0.75rem" }}>{a.description}</div>
                </div>
                <span className="gx-badge">{unlocked ? `+${a.xp} XP` : "LOCKED"}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="gx-panel">
        <div className="gx-kicker">Rankings (local demo board)</div>
        <div className="gx-list" style={{ marginTop: "0.65rem" }}>
          {[
            { n: profile.character.name, xp: prog.xp, you: true },
            { n: "ShardQueen", xp: 4200 },
            { n: "JupPilot", xp: 3900 },
            { n: "LimeFox", xp: 3100 },
            { n: "PlazaKid", xp: 2500 },
          ]
            .sort((a, b) => b.xp - a.xp)
            .map((r, i) => (
              <div key={r.n} className="gx-row">
                <span>#{i + 1} {r.n}{r.you ? " (you)" : ""}</span>
                <span className="gx-badge">{r.xp.toLocaleString()} XP</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export function PlayBattlePassPage() {
  const { profile, updateProfile } = useGameProfile();
  const season = BATTLE_PASS_SEASON;
  const seasonXp = profile.progression.seasonXp;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div>
        <div className="gx-kicker">Battle pass</div>
        <h1 className="gx-title" style={{ fontSize: "1.7rem" }}>{season.name}</h1>
        <p className="gx-lead">{season.theme}. Season XP: {seasonXp}</p>
      </div>

      <div className="gx-panel" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="gx-btn gx-btn-primary"
          onClick={() => updateProfile((p) => ({ ...p, progression: { ...p.progression, battlePassPremium: true } }))}
        >
          {profile.progression.battlePassPremium ? "Premium active" : "Unlock premium (UI)"}
        </button>
        <button
          type="button"
          className="gx-btn"
          onClick={() => updateProfile((p) => ({ ...p, progression: claimBattlePassTier(p.progression) }))}
        >
          Claim available tiers
        </button>
      </div>

      <div className="gx-list">
        {season.tiers.map((t) => {
          const unlocked = seasonXp >= t.xpRequired;
          const claimed = profile.progression.claimedBattlePassTiers.includes(t.tier);
          return (
            <div key={t.tier} className="gx-row" style={{ opacity: unlocked ? 1 : 0.5 }}>
              <div>
                <strong style={{ fontFamily: "var(--gx-display)", fontSize: "0.8rem" }}>Tier {t.tier}</strong>
                <div style={{ color: "var(--gx-muted)", fontSize: "0.75rem" }}>
                  Free: {t.freeReward?.shards ? `${t.freeReward.shards} shards` : t.freeReward?.cosmeticId || t.freeReward?.itemId || "—"}
                  {" · "}
                  Premium: {t.premiumReward?.shards ? `${t.premiumReward.shards} shards` : t.premiumReward?.cosmeticId || t.premiumReward?.itemId || "—"}
                </div>
              </div>
              <span className="gx-badge">{claimed ? "CLAIMED" : unlocked ? "READY" : `${t.xpRequired} XP`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
