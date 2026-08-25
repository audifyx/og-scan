import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium outline-none select-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:not-disabled:scale-[0.96] transition-[color,background-color,box-shadow,transform,border-color] duration-150 ease-out",
  {
    variants: {
      variant: {
        default:
          "bg-accent-2 text-fg hover:bg-accent shadow-[0_0_0_1px_rgb(196_181_253_/_0.2)]",
        ghost: "text-muted hover:text-fg hover:bg-bg-hover",
        outline:
          "border border-line bg-transparent text-muted hover:text-fg hover:bg-bg-hover hover:border-line-strong",
        subtle: "bg-bg-hover text-fg hover:bg-bg-raised",
        chip: "border border-line bg-bg-sunken text-muted hover:text-fg hover:border-line-strong",
      },
      size: {
        default: "h-9 rounded-md px-3 text-sm",
        sm: "h-7 rounded-sm px-2 text-xs",
        xs: "h-6 rounded-sm px-1.5 text-2xs",
        icon: "size-8 rounded-md",
        "icon-sm": "size-7 rounded-sm",
        "icon-xs": "size-6 rounded-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
