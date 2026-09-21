import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { formatCount, formatMoney } from "@/lib/format";
import { statusAsOf, type LoanResult } from "@/lib/loan";

export function AsOfStatus({ result, rate }: { result: LoanResult; rate: number }) {
  const [asOf, setAsOf] = useState<Date | null>(null);

  useEffect(() => {
    setAsOf(new Date());
  }, []);

  const status = useMemo(
    () => (asOf ? statusAsOf(result, rate, asOf) : null),
    [result, rate, asOf],
  );

  if (!status) {
    return <div className="h-24 rounded-md bg-muted" />;
  }

  const caption =
    status.phase === "paid"
      ? `Paid off ${format(status.lastPayment.date, "MMM d, yyyy")}.`
      : status.phase === "upcoming"
        ? `The note has not started. First payment ${status.nextPayment ? format(status.nextPayment.date, "MMM d, yyyy") : "—"}.`
        : status.paymentsMade === 0
          ? `Starts today. First payment ${status.nextPayment ? format(status.nextPayment.date, "MMM d, yyyy") : "—"}.`
          : `Payment ${formatCount(status.paymentsMade)} of ${formatCount(result.paymentCount)} should already be in. ${formatCount(status.paymentsLeft)} left.`;

  const nextLine =
    status.phase === "paid"
      ? null
      : status.nextPayment && status.daysUntilNext != null
        ? status.daysUntilNext === 0
          ? `Next payment ${formatMoney(status.nextPayment.payment)} is due today.`
          : `Next payment ${formatMoney(status.nextPayment.payment)} in ${formatCount(status.daysUntilNext)} day${status.daysUntilNext === 1 ? "" : "s"} (${format(status.nextPayment.date, "MMM d")}).`
        : null;

  return (
    <div className="rounded-md bg-muted px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {status.phase === "paid" ? "As of today" : "Owed as of today"}
      </p>
      <p className="mt-1 font-display text-3xl font-medium tracking-tight tabular-nums">
        {status.phase === "paid" ? "Paid off" : formatMoney(status.owedToday)}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{caption}</p>
      {nextLine ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{nextLine}</p>
      ) : null}
      {status.phase === "active" && status.accruedInterest > 0 ? (
        <p className="mt-1 text-xs text-interest">
          Includes {formatMoney(status.accruedInterest)} interest since the last payment.
        </p>
      ) : null}
    </div>
  );
}
