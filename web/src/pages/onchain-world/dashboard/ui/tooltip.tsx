import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export function TooltipProvider({
  delayDuration = 250,
  children,
}: {
  delayDuration?: number;
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-md bg-bg-raised px-2 py-1 text-2xs text-fg shadow-[0_0_0_1px_rgb(139_92_246_/_0.28),0_8px_24px_rgb(0_0_0_/_0.4)]",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}
