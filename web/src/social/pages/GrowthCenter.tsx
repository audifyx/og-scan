import { useMemo, useState } from "react";
import { useCurrentProfile, useSocialStore } from "../hooks/useSocialStore";
import { progressToNext, XP_REWARDS } from "../growth/xp";
import { generateReferralCode, referralLink, scoreReferralLeaderboard } from "../growth/referrals";
import { claimDailyCheckin } from "../store/localSocialStore";

export default function GrowthCenter() {
  const { profiles, referralCodes, currentUserId } = useSocialStore();
  const me = useCurrentProfile();
  const [copied, setCopied] = useState(false);
  const code = referralCodes[currentUserId] || generateReferralCode(currentUserId);
  const link = referralLink(code);
  const prog = progressToNext(me?.xp ?? 0);

  const board = useMemo(
    () =>
      scoreReferralLeaderboard(
        profiles.map((p) => ({
          code: referralCodes[p.id] || generateReferralCode(p.id),
          ownerId: p.id,
          ownerName: p.username,
          createdAt: p.createdAt,
          signups: Math.max(1, Math.floor(p.followers.length * 1.5)),
          qualified: Math.max(0, p.followers.length),
          xpEarned: Math.floor(p.xp / 10),
        })),
      ),
    [profiles, referralCodes],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <header className="oxs-hero">
        <h1>Growth</h1>
        <p>Referral programs, XP rewards, reputation progress, and invite loops that grow OrbitX.</p>
      </header>

      <div className="oxs-grid oxs-grid-3" style={{ marginBottom: "1rem" }}>
        <div className="oxs-panel oxs-stat">
          <div className="label">XP</div>
          <div className="value">{me?.xp ?? 0}</div>
          <div className="oxs-muted" style={{ fontSize: "0.78rem", marginTop: "0.35rem" }}>
            {prog.current.title} · reputation {me?.reputation ?? 0}
          </div>
          <div className="oxs-progress" style={{ marginTop: "0.55rem" }}>
            <span style={{ width: `${prog.pct}%` }} />
          </div>
          <button className="oxs-btn" type="button" style={{ marginTop: "0.75rem" }} onClick={() => claimDailyCheckin()}>
            Claim daily +{XP_REWARDS.daily_checkin} XP
          </button>
        </div>
        <div className="oxs-panel">
          <h3>Your referral</h3>
          <div className="oxs-muted" style={{ fontSize: "0.75rem", marginBottom: "0.35rem" }}>
            Code
          </div>
          <div style={{ fontFamily: "var(--oxs-display)", fontWeight: 800, fontSize: "1.4rem", letterSpacing: "0.08em" }}>
            {code}
          </div>
          <div className="oxs-muted" style={{ fontSize: "0.75rem", margin: "0.65rem 0 0.35rem", wordBreak: "break-all" }}>
            {link}
          </div>
          <button className="oxs-btn" type="button" onClick={copy}>
            {copied ? "Copied" : "Copy invite link"}
          </button>
        </div>
        <div className="oxs-panel">
          <h3>XP menu</h3>
          <div className="oxs-muted" style={{ fontSize: "0.8rem" }}>
            {Object.entries(XP_REWARDS).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.25rem 0" }}>
                <span>{k.replace(/_/g, " ")}</span>
                <strong>+{v}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="oxs-panel">
        <h3>Referral leaderboard</h3>
        <table className="oxs-table">
          <thead>
            <tr>
              <th>Creator</th>
              <th>Signups</th>
              <th>Qualified</th>
              <th>XP</th>
            </tr>
          </thead>
          <tbody>
            {board.slice(0, 8).map((r) => (
              <tr key={r.ownerId}>
                <td>@{r.ownerName}</td>
                <td>{r.signups}</td>
                <td>{r.qualified}</td>
                <td>{r.xpEarned}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
