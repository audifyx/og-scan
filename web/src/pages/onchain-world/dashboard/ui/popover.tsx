import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  align = "end",
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-64 origin-[var(--radix-popover-content-transform-origin)] rounded-lg bg-bg-raised p-3 text-sm text-fg shadow-[0_0_0_1px_rgb(139_92_246_/_0.28),0_16px_40px_rgb(0_0_0_/_0.5)] data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-[opacity,transform] duration-150 ease-out",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
