import { useEffect } from "react";
import { Wrench } from "lucide-react";

/**
 * Temporary site-wide notice while the Supabase backend is being replaced.
 * Remove this component (and its <BackendMigrationBanner /> usage in App.tsx)
 * once the migration is complete.
 */
export function BackendMigrationBanner() {
  useEffect(() => {
    const prev = document.body.style.paddingTop;
    document.body.style.paddingTop = "40px";
    return () => {
      document.body.style.paddingTop = prev;
    };
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-[200] flex h-10 items-center justify-center gap-2 border-b border-[#17ff4d]/40 bg-[#071008]/95 px-4 backdrop-blur">
      <Wrench className="h-3.5 w-3.5 shrink-0 text-[#17ff4d]" />
      <p className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-[#17ff4d]">
        OrbitX will be temporarily down while the backend is being replaced
      </p>
    </div>
  );
}
