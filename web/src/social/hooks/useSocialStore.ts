import { useCallback, useEffect, useState } from "react";
import {
  getSocialState,
  subscribeSocial,
  type SocialState,
} from "../store/localSocialStore";

export function useSocialStore(): SocialState & { refresh: () => void } {
  const [snap, setSnap] = useState<SocialState>(() => getSocialState());
  const refresh = useCallback(() => setSnap({ ...getSocialState() }), []);

  useEffect(() => subscribeSocial(refresh), [refresh]);

  return { ...snap, refresh };
}

export function useCurrentProfile() {
  const s = useSocialStore();
  return s.profiles.find((p) => p.id === s.currentUserId) ?? null;
}
