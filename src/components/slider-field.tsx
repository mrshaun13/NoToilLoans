import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function SliderField({
  id,
  label,
  prefix,
  suffix,
  text,
  onText,
  onCommit,
  value,
  min,
  max,
  step,
  display,
}: {
  id: string;
  label: string;
  prefix?: string;
  suffix?: string;
  text: string;
  onText: (v: string) => void;
  onCommit: (n: number) => void;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <p className="font-display text-xl font-medium tracking-tight tabular-nums">{display}</p>
      </div>
      <Slider
        className="mt-3"
        min={min}
        max={max}
        step={step}
        value={[clamp(value, min, max)]}
        onValueChange={([v]) => onCommit(v ?? min)}
        aria-label={label}
      />
      <div className="relative mt-3">
        {prefix ? (
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <Input
          id={id}
          inputMode="decimal"
          value={text}
          onChange={(e) => onText(e.target.value)}
          onBlur={() => {
            const n = Number(text.replace(/[^0-9.]/g, ""));
            onCommit(Number.isFinite(n) ? n : value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={cn(prefix && "pl-7", suffix && "pr-8")}
        />
        {suffix ? (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}
