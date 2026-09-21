import { formatMoney } from "@/lib/format";
import { mixAtPoint, share, type LoanMix as Mix } from "@/lib/analytics";
import type { PaymentPoint } from "@/lib/loan";
import { cn } from "@/lib/utils";

export function LoanMix({
  principal,
  point,
  totalInterest,
}: {
  principal: number;
  point: PaymentPoint;
  totalInterest: number;
}) {
  const mix = mixAtPoint(principal, point, totalInterest);
  return <MixVisual mix={mix} />;
}

export function MixVisual({ mix, compact = false }: { mix: Mix; compact?: boolean }) {
  const paidPrincipalPct = share(mix.principalPaid, mix.paid);
  const remainPrincipalPct = share(mix.principalLeft, mix.remaining);

  return (
    <div className={cn("grid gap-5", compact ? "" : "sm:grid-cols-2")}>
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Paid so far
        </p>
        <p className="mt-1 font-display text-2xl font-medium tracking-tight tabular-nums">
          {formatMoney(mix.paid)}
        </p>
        <div className="mt-3 flex items-center gap-4">
          <Donut principalPct={paidPrincipalPct} />
          <div className="min-w-0 space-y-1 text-sm">
            <Row
              tone="principal"
              label="Toward principal"
              value={formatMoney(mix.principalPaid)}
            />
            <Row tone="interest" label="Toward interest" value={formatMoney(mix.interestPaid)} />
          </div>
        </div>
        <Bar
          className="mt-3"
          left={mix.principalPaid}
          right={mix.interestPaid}
          leftClass="bg-principal"
          rightClass="bg-interest"
        />
      </div>
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Still remaining
        </p>
        <p className="mt-1 font-display text-2xl font-medium tracking-tight tabular-nums">
          {formatMoney(mix.remaining)}
        </p>
        <div className="mt-3 flex items-center gap-4">
          <Donut principalPct={remainPrincipalPct} />
          <div className="min-w-0 space-y-1 text-sm">
            <Row tone="principal" label="Principal left" value={formatMoney(mix.principalLeft)} />
            <Row tone="interest" label="Interest left" value={formatMoney(mix.interestLeft)} />
          </div>
        </div>
        <Bar
          className="mt-3"
          left={mix.principalLeft}
          right={mix.interestLeft}
          leftClass="bg-principal"
          rightClass="bg-interest"
        />
      </div>
    </div>
  );
}

function Donut({ principalPct }: { principalPct: number }) {
  const p = Math.max(0, Math.min(100, principalPct));
  return (
    <div
      className="size-16 shrink-0 rounded-full p-1.5"
      style={{
        background: `conic-gradient(var(--color-principal) 0 ${p}%, var(--color-interest) ${p}% 100%)`,
      }}
      aria-hidden="true"
    >
      <div className="size-full rounded-full bg-card" />
    </div>
  );
}

function Bar({
  left,
  right,
  leftClass,
  rightClass,
  className,
}: {
  left: number;
  right: number;
  leftClass: string;
  rightClass: string;
  className?: string;
}) {
  const total = left + right;
  return (
    <div className={cn("flex h-2.5 overflow-hidden rounded-full bg-muted", className)}>
      <div className={leftClass} style={{ width: `${share(left, total)}%` }} />
      <div className={rightClass} style={{ width: `${share(right, total)}%` }} />
    </div>
  );
}

function Row({
  tone,
  label,
  value,
}: {
  tone: "principal" | "interest";
  label: string;
  value: string;
}) {
  return (
    <p className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">
        <span
          className={cn(
            "mr-2 inline-block size-2 rounded-full",
            tone === "principal" ? "bg-principal" : "bg-interest",
          )}
        />
        {label}
      </span>
      <span className="tabular-nums">{value}</span>
    </p>
  );
}
