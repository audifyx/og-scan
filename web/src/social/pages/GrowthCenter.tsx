import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { SocialPageHeader } from "../components/SocialPageHeader";
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
      <SocialPageHeader title="Growth" subtitle="XP, referrals, and reputation — grow your OrbitX presence." />

      <div className="oxs-grid oxs-grid-3">
        <div className="oxs-stat">
          <div className="label">XP</div>
          <div className="value">{me?.xp ?? 0}</div>
          <div className="oxs-muted" style={{ fontSize: "0.78rem", marginTop: "0.35rem" }}>
            {prog.current.title} · rep {me?.reputation ?? 0}
          </div>
          <div className="oxs-progress" style={{ marginTop: "0.5rem" }}>
            <span style={{ width: `${prog.pct}%` }} />
          </div>
          <button className="oxs-btn" type="button" style={{ marginTop: "0.75rem" }} onClick={() => claimDailyCheckin()}>
            Daily +{XP_REWARDS.daily_checkin} XP
          </button>
        </div>
        <div className="oxs-panel--card" style={{ margin: 0 }}>
          <h3>Referral link</h3>
          <div style={{ fontWeight: 800, fontSize: "1.25rem", letterSpacing: "0.06em" }}>{code}</div>
          <div className="oxs-muted" style={{ fontSize: "0.78rem", margin: "0.5rem 0", wordBreak: "break-all" }}>{link}</div>
          <button className="oxs-btn oxs-btn-tg" type="button" onClick={copy}>
            {copied ? "Copied!" : "Copy invite"}
          </button>
        </div>
        <div className="oxs-panel--card" style={{ margin: 0 }}>
          <h3>XP rewards</h3>
          <div className="oxs-muted" style={{ fontSize: "0.82rem" }}>
            {Object.entries(XP_REWARDS).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0" }}>
                <span>{k.replace(/_/g, " ")}</span>
                <strong style={{ color: "var(--oxs-x)" }}>+{v}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="oxs-panel--card">
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
                <td>
                  <Link className="oxs-link" to={`/hq/profile/${r.ownerId}`}>@{r.ownerName}</Link>
                </td>
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
