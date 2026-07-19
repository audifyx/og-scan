import { ShieldCheck, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AntiVampProtectionBadge() {
  // This component will display the anti-vamp protection status.
  // For now, it's a static badge, but can be made dynamic later.
  return (
    <Badge variant="outline" className="border-[hsl(var(--og-lime))]/40 text-[hsl(var(--og-lime))] flex items-center gap-1">
      <ShieldCheck className="h-3 w-3" />
      Anti-vamp Protected
    </Badge>
  );
}
