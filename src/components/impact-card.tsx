import { describeImpact, type AmendmentImpact } from "@/lib/impact";
import { cn } from "@/lib/utils";

export function ImpactCard({
  impact,
  className,
}: {
  impact: AmendmentImpact;
  className?: string;
}) {
  const copy = describeImpact(impact);
  return (
    <div
      className={cn(
        "rounded-md px-3 py-2.5",
        copy.tone === "better" && "bg-ok/15",
        copy.tone === "worse" && "bg-interest/15",
        (copy.tone === "mixed" || copy.tone === "same") && "bg-muted",
        className,
      )}
    >
      <p
        className={cn(
          "text-sm font-medium leading-snug",
          copy.tone === "better" && "text-ok",
          copy.tone === "worse" && "text-interest",
        )}
      >
        {copy.headline}
      </p>
      {copy.detail ? (
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{copy.detail}</p>
      ) : null}
    </div>
  );
}

export function ImpactLine({ impact }: { impact: AmendmentImpact }) {
  const copy = describeImpact(impact);
  return (
    <span
      className={cn(
        "block text-xs leading-relaxed",
        copy.tone === "better" && "text-ok",
        copy.tone === "worse" && "text-interest",
        (copy.tone === "mixed" || copy.tone === "same") && "text-muted-foreground",
      )}
    >
      {copy.headline}
    </span>
  );
}
