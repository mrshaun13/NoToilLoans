import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ImpactLine } from "@/components/impact-card";
import { formatMoney } from "@/lib/format";
import { describeTermsChange, isCashPoint, startOfLocalDay, type PaymentPoint } from "@/lib/loan";
import { cn } from "@/lib/utils";

function kindLabel(row: PaymentPoint): string {
  if (row.kind === "extra") return "Extra";
  if (row.kind === "terms") return "Terms";
  return String(row.scheduledNumber ?? row.index);
}

export function PaymentSchedule({
  points,
  selectedIndex,
  onSelect,
  asOf,
}: {
  points: PaymentPoint[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  asOf?: Date;
}) {
  const rows = points.length > 1 ? points.slice(1) : [];
  const events = rows.filter((row) => row.kind === "extra" || row.kind === "terms");
  const years = useMemo(() => {
    const set = new Set(rows.map((row) => row.date.getFullYear()));
    return [...set].sort((a, b) => a - b);
  }, [rows]);

  const selectedRow = rows.find((row) => row.index === selectedIndex);
  const fallbackYear = (() => {
    if (selectedRow) return selectedRow.date.getFullYear();
    if (asOf) {
      const today = startOfLocalDay(asOf);
      const next = rows.find(
        (row) => isCashPoint(row) && startOfLocalDay(row.date) > today,
      );
      if (next) return next.date.getFullYear();
      const last = [...rows].reverse().find((row) => startOfLocalDay(row.date) <= today);
      if (last) return last.date.getFullYear();
    }
    return years[0];
  })();

  const [pinnedYear, setPinnedYear] = useState<number | null>(null);
  const year = pinnedYear && years.includes(pinnedYear) ? pinnedYear : fallbackYear;
  const visible = rows.filter((row) => row.date.getFullYear() === year);
  const today = asOf ? startOfLocalDay(asOf) : null;
  const nextDue = today
    ? rows.find((row) => isCashPoint(row) && startOfLocalDay(row.date) > today)
    : null;

  if (rows.length === 0) return null;

  return (
    <div className="space-y-4">
      {events.length > 0 ? (
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Changes
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {events.map((row) => (
              <button
                key={row.index}
                type="button"
                onClick={() => {
                  setPinnedYear(row.date.getFullYear());
                  onSelect(row.index);
                }}
                className={cn(
                  "flex min-h-12 flex-col gap-1 rounded-md px-3 py-2.5 text-left transition-colors duration-150",
                  row.index === selectedIndex ? "bg-card shadow-ledger" : "bg-muted hover:bg-secondary",
                )}
              >
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">
                    {row.kind === "extra" ? "Extra payment" : "Terms changed"}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {format(row.date, "MMM d, yyyy")}
                    </span>
                  </span>
                  {row.kind === "extra" ? (
                    <span className="shrink-0 tabular-nums">{formatMoney(row.payment)}</span>
                  ) : null}
                </span>
                {row.kind === "terms" ? (
                  <TermChangeCopy row={row} />
                ) : row.note ? (
                  <span className="text-xs text-muted-foreground">{row.note}</span>
                ) : null}
                {row.impact ? <ImpactLine impact={row.impact} /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {years.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {years.map((item) => {
            const active = item === year;
            const count = rows.filter((row) => row.date.getFullYear() === item).length;
            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setPinnedYear(item);
                  const first = rows.find((row) => row.date.getFullYear() === item);
                  if (first) onSelect(first.index);
                }}
                className={cn(
                  "min-h-11 rounded-md px-3 text-sm",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
              >
                {item}
                <span
                  className={cn(
                    "ml-1.5 text-xs",
                    active ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  · {count}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <ul className="space-y-2">
        {visible.map((row) => {
          const active = row.index === selectedIndex;
          const paid = today ? startOfLocalDay(row.date) <= today && isCashPoint(row) : false;
          const isNext = nextDue?.index === row.index;
          return (
            <li key={row.index}>
              <button
                type="button"
                onClick={() => onSelect(row.index)}
                className={cn(
                  "flex w-full min-h-14 flex-col gap-1 rounded-md px-3 py-2.5 text-left transition-colors duration-150",
                  active ? "bg-card shadow-ledger" : "bg-muted hover:bg-secondary",
                )}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">
                    {kindLabel(row)}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {format(row.date, "MMM d, yyyy")}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums">
                    {row.kind === "terms" ? "—" : formatMoney(row.payment)}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {row.kind === "terms" ? (
                    <TermChangeCopy row={row} />
                  ) : (
                    <>
                      <span className="text-interest">Interest {formatMoney(row.interest)}</span>
                      <span>Principal {formatMoney(row.principalPaid)}</span>
                      <span>Balance {formatMoney(row.balance)}</span>
                    </>
                  )}
                  {row.impact ? <ImpactLine impact={row.impact} /> : null}
                  {paid ? <span>Paid</span> : null}
                  {isNext ? <span>Next</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TermChangeCopy({ row }: { row: PaymentPoint }) {
  const changes =
    row.termsBefore && row.termsAfter
      ? describeTermsChange(row.termsBefore, row.termsAfter)
      : [];
  if (changes.length === 0 && !row.note) {
    return <span>Terms changed</span>;
  }
  return (
    <span className="block text-xs leading-relaxed">
      {changes.map((line) => (
        <span key={line} className="block text-foreground">
          {line}
        </span>
      ))}
      {row.note ? <span className="block text-muted-foreground">{row.note}</span> : null}
    </span>
  );
}
