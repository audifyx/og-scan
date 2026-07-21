import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";

const OWNER_EMAILS = ["audifyx@gmail.com", "beatsbyaid3n@gmail.com"];
const OWNER_EMAIL = OWNER_EMAILS[0];

/**
 * Keep full admin access owner-only, but expose support-team detection
 * from profile flags so gold/official accounts can access support inboxes.
 */
export const useAdmin = () => {
  const { user, profile } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isSupportAgent, setIsSupportAgent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setIsOwner(false);
      setIsSupportAgent(false);
      setLoading(false);
      return;
    }

    const ownerMatch = !!user.email && OWNER_EMAILS.includes(user.email.toLowerCase());
    const officialTeamMatch = Boolean(profile?.is_official_account || profile?.affiliate_org_id);

    setIsOwner(ownerMatch);
    setIsAdmin(ownerMatch);
    setIsSupportAgent(ownerMatch || officialTeamMatch);
    setLoading(false);
  }, [profile?.affiliate_org_id, profile?.is_official_account, user]);

  return {
    isAdmin,
    isOwner,
    isSupportAgent,
    loading,
    ownerEmail: OWNER_EMAIL,
  };
};
