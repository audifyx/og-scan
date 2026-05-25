import { useSecurityTracker } from "@/hooks/useSecurityTracker";

/** Invisible component — mounts in App.tsx to track device/IP on login */
export function SecurityTracker() {
  useSecurityTracker();
  return null;
}
