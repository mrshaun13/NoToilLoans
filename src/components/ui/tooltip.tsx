import * as React from "react";
import {
  Tooltip as TooltipRoot,
  TooltipContent as TooltipContentPrimitive,
  TooltipPortal,
  TooltipProvider as TooltipProviderPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive,
} from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export function TooltipProvider({
  delayDuration = 200,
  ...props
}: React.ComponentProps<typeof TooltipProviderPrimitive>) {
  return <TooltipProviderPrimitive delayDuration={delayDuration} {...props} />;
}

export function Tooltip({ ...props }: React.ComponentProps<typeof TooltipRoot>) {
  return <TooltipRoot {...props} />;
}

export function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipTriggerPrimitive>) {
  return <TooltipTriggerPrimitive {...props} />;
}

export function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipContentPrimitive>) {
  return (
    <TooltipPortal>
      <TooltipContentPrimitive
        sideOffset={sideOffset}
        className={cn(
          "z-50 max-w-xs rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground shadow-ledger",
          className,
        )}
        {...props}
      >
        {children}
      </TooltipContentPrimitive>
    </TooltipPortal>
  );
}
