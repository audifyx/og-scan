import { cn } from "@/lib/utils";

export function OrbitxMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("text-accent", className)}
      aria-hidden="true"
    >
      <circle
        cx="16"
        cy="16"
        r="5.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.3"
      />
      <ellipse
        cx="16"
        cy="16"
        rx="12.4"
        ry="5.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        transform="rotate(-28 16 16)"
        opacity="0.9"
      />
      <circle cx="26.6" cy="11" r="1.8" fill="currentColor" />
    </svg>
  );
}
