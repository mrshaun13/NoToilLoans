import * as React from "react";
import {
  Slider as SliderPrimitive,
  SliderRange,
  SliderThumb,
  SliderTrack,
} from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive>) {
  const thumbs = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min]),
    [value, defaultValue, min],
  );

  return (
    <SliderPrimitive
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn("relative flex w-full touch-none items-center select-none", className)}
      {...props}
    >
      <SliderTrack className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderRange className="absolute h-full bg-primary" />
      </SliderTrack>
      {thumbs.map((_, i) => (
        <SliderThumb
          key={i}
          className="relative block size-5 rounded-full bg-primary shadow-ledger ring-0 transition-[box-shadow,transform] duration-150 ease-out after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 hover:shadow-ledger-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive>
  );
}
