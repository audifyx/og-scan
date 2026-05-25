import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";

const OWNER_EMAIL = "audifyx@gmail.com";

/**
 * Email-only admin check — avoids querying admin_roles table
 * which has an infinite RLS recursion bug.
 */
export const useAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setIsOwner(false);
      setLoading(false);
      return;
    }

    // Pure email check — no DB query, no RLS recursion
    const ownerMatch = user.email === OWNER_EMAIL;
    setIsOwner(ownerMatch);
    setIsAdmin(ownerMatch);
    setLoading(false);
  }, [user]);

  return { isAdmin, isOwner, loading, ownerEmail: OWNER_EMAIL };
};
