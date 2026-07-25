import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCurrentProfile, useSocialStore } from "../hooks/useSocialStore";
import { generateReferralCode, referralLink } from "../growth/referrals";

/** Landing for /hq/invite?ref=CODE — attribution + CTA into Growth. */
export default function InviteLanding() {
  const [params] = useSearchParams();
  const ref = params.get("ref") || "";
  const { referralCodes, currentUserId } = useSocialStore();
  const me = useCurrentProfile();
  const myCode = referralCodes[currentUserId] || generateReferralCode(currentUserId);

  useEffect(() => {
    if (ref) {
      try {
        localStorage.setItem("orbitx-pending-ref", ref);
      } catch {
        /* ignore */
      }
    }
  }, [ref]);

  return (
    <div>
      <header className="oxs-hero">
        <h1>OrbitX</h1>
        <p>
          {ref
            ? `You were invited with code ${ref}. Join the social graph, claim XP, and grow with your crew.`
            : "Invite friends into OrbitX Social — referrals power XP and creator growth."}
        </p>
      </header>
      <div className="oxs-panel">
        <h3>Your invite</h3>
        <p className="oxs-muted" style={{ fontSize: "0.85rem" }}>
          Signed in as @{me?.username || "you"} · share {referralLink(myCode)}
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
          <Link to="/hq/growth" className="oxs-btn" style={{ textDecoration: "none" }}>
            Open growth
          </Link>
          <Link to="/hq/feed" className="oxs-btn oxs-btn-ghost" style={{ textDecoration: "none" }}>
            Enter feed
          </Link>
        </div>
      </div>
    </div>
  );
}
