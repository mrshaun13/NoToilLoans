import { differenceInCalendarDays, format } from "date-fns";
import { formatMoney } from "./format.ts";
import { parseISODate, toISODate, type LoanResult } from "./loan.ts";

export type AmendmentImpact = {
  payoffDaysDelta: number;
  interestDelta: number;
  payoffBefore: string | null;
  payoffAfter: string | null;
  interestBefore: number;
  interestAfter: number;
  neverBefore: boolean;
  neverAfter: boolean;
};

export function isAmendmentImpact(value: unknown): value is AmendmentImpact {
  if (!value || typeof value !== "object") return false;
  const row = value as AmendmentImpact;
  return typeof row.payoffDaysDelta === "number" && typeof row.interestDelta === "number";
}

export function compareResults(before: LoanResult, after: LoanResult): AmendmentImpact {
  const payoffBefore = before.neverPaysOff ? null : before.payoffDate;
  const payoffAfter = after.neverPaysOff ? null : after.payoffDate;
  let payoffDaysDelta = 0;
  if (payoffBefore && payoffAfter) {
    payoffDaysDelta = differenceInCalendarDays(payoffAfter, payoffBefore);
  }
  const interestBefore = before.neverPaysOff ? Number.POSITIVE_INFINITY : before.totalInterest;
  const interestAfter = after.neverPaysOff ? Number.POSITIVE_INFINITY : after.totalInterest;
  const interestDelta =
    Number.isFinite(interestBefore) && Number.isFinite(interestAfter)
      ? Math.round((interestAfter - interestBefore + Number.EPSILON) * 100) / 100
      : 0;
  return {
    payoffDaysDelta,
    interestDelta,
    payoffBefore: payoffBefore ? toISODate(payoffBefore) : null,
    payoffAfter: payoffAfter ? toISODate(payoffAfter) : null,
    interestBefore: Number.isFinite(interestBefore) ? interestBefore : 0,
    interestAfter: Number.isFinite(interestAfter) ? interestAfter : 0,
    neverBefore: before.neverPaysOff,
    neverAfter: after.neverPaysOff,
  };
}

export function formatTimeSpan(days: number): string {
  const n = Math.abs(Math.round(days));
  if (n === 0) return "0 days";
  if (n === 1) return "1 day";
  if (n < 11) return `${n} days`;
  const weeks = Math.round(n / 7);
  if (n < 40 && Math.abs(weeks * 7 - n) <= 2) {
    return weeks === 1 ? "1 week" : `${weeks} weeks`;
  }
  const months = Math.round(n / 30.437);
  if (months >= 1 && months < 18) {
    return months === 1 ? "1 month" : `${months} months`;
  }
  const years = Math.round((n / 365.25) * 10) / 10;
  if (years === 1) return "1 year";
  if (Number.isInteger(years)) return `${years} years`;
  return `${years} years`;
}

export type ImpactCopy = {
  headline: string;
  detail: string;
  tone: "better" | "worse" | "mixed" | "same";
};

export function describeImpact(impact: AmendmentImpact): ImpactCopy {
  if (impact.neverAfter && !impact.neverBefore) {
    return {
      headline: "These terms never pay the loan off",
      detail: "Raise the payment or pay more often so the balance can fall.",
      tone: "worse",
    };
  }
  if (impact.neverBefore && !impact.neverAfter) {
    const when = impact.payoffAfter ? formatLong(impact.payoffAfter) : "a real payoff date";
    return {
      headline: `This actually pays it off by ${when}`,
      detail: `Interest would be ${formatMoney(impact.interestAfter)}.`,
      tone: "better",
    };
  }
  if (impact.neverBefore && impact.neverAfter) {
    return {
      headline: "Still never pays off",
      detail: "The balance would keep growing.",
      tone: "worse",
    };
  }

  const timeBit =
    impact.payoffDaysDelta === 0
      ? ""
      : impact.payoffDaysDelta < 0
        ? `shortens payoff by ${formatTimeSpan(impact.payoffDaysDelta)}`
        : `adds ${formatTimeSpan(impact.payoffDaysDelta)} to the life of the loan`;
  const absInt = Math.abs(impact.interestDelta);
  const interestBit =
    absInt < 0.5
      ? ""
      : impact.interestDelta < 0
        ? `saves ${formatMoney(absInt)} in interest`
        : `${formatMoney(absInt)} more interest`;

  let headline: string;
  if (timeBit && interestBit) {
    headline = `${cap(timeBit)} and ${interestBit}`;
  } else if (timeBit) {
    headline = cap(timeBit);
  } else if (interestBit) {
    headline = cap(interestBit);
  } else {
    headline = "Payoff and interest stay about the same";
  }

  const details: string[] = [];
  if (impact.payoffBefore && impact.payoffAfter && impact.payoffBefore !== impact.payoffAfter) {
    details.push(`Payoff ${formatLong(impact.payoffBefore)} → ${formatLong(impact.payoffAfter)}`);
  }
  if (absInt >= 0.5) {
    details.push(
      `Interest ${formatMoney(impact.interestBefore)} → ${formatMoney(impact.interestAfter)}`,
    );
  }

  const timeBetter = impact.payoffDaysDelta < 0;
  const timeWorse = impact.payoffDaysDelta > 0;
  const intBetter = impact.interestDelta < -0.5;
  const intWorse = impact.interestDelta > 0.5;
  let tone: ImpactCopy["tone"];
  if (!timeBetter && !timeWorse && !intBetter && !intWorse) tone = "same";
  else if ((timeBetter || !timeWorse) && (intBetter || !intWorse) && (timeBetter || intBetter)) {
    tone = "better";
  } else if ((timeWorse || !timeBetter) && (intWorse || !intBetter) && (timeWorse || intWorse)) {
    tone = "worse";
  } else tone = "mixed";

  return { headline, detail: details.join(" · "), tone };
}

function cap(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function formatLong(iso: string): string {
  return format(parseISODate(iso), "MMM d, yyyy");
}
