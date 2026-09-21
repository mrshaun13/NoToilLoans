import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-11 w-full min-w-0 max-w-full rounded-md bg-muted px-3 text-sm text-foreground tabular-nums outline-none",
        "ring-1 ring-border",
        "transition-[box-shadow,background-color] duration-150 ease-out",
        "placeholder:text-muted-foreground",
        "focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
