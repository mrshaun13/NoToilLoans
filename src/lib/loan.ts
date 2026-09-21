import { addDays, addMonths, addWeeks, differenceInCalendarDays } from "date-fns";
import type { AmendmentImpact } from "./impact.ts";

export type Frequency = "weekly" | "biweekly" | "semimonthly" | "monthly";

export const FREQUENCIES: {
  id: Frequency;
  label: string;
  hint: string;
  perYear: number;
}[] = [
  { id: "weekly", label: "Weekly", hint: "52 payments a year", perYear: 52 },
  { id: "biweekly", label: "Every 2 weeks", hint: "26 payments a year", perYear: 26 },
  { id: "semimonthly", label: "Twice a month", hint: "24 payments a year", perYear: 24 },
  { id: "monthly", label: "Monthly", hint: "12 payments a year", perYear: 12 },
];

export function frequencyMeta(id: Frequency) {
  return FREQUENCIES.find((f) => f.id === id) ?? FREQUENCIES[3];
}

export function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function paymentDate(start: Date, n: number, frequency: Frequency): Date {
  if (n <= 0) return new Date(start.getFullYear(), start.getMonth(), start.getDate());
  switch (frequency) {
    case "weekly":
      return addWeeks(start, n);
    case "biweekly":
      return addWeeks(start, n * 2);
    case "monthly":
      return addMonths(start, n);
    case "semimonthly": {
      const months = Math.floor(n / 2);
      const secondHalf = n % 2 === 1;
      const base = addMonths(start, months);
      return secondHalf ? addDays(base, 15) : base;
    }
  }
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(1, differenceInCalendarDays(to, from));
}

export type TermSnapshot = {
  payment: number;
  annualRatePct: number;
  frequency: Frequency;
};

export function describeTerms(terms: TermSnapshot): string {
  return `$${terms.payment.toFixed(2)} ${frequencyMeta(terms.frequency).label.toLowerCase()} at ${terms.annualRatePct}%`;
}

export function describeTermsChange(before: TermSnapshot, after: TermSnapshot): string[] {
  const lines: string[] = [];
  if (before.payment !== after.payment) {
    lines.push(`Payment $${before.payment.toFixed(2)} → $${after.payment.toFixed(2)}`);
  }
  if (before.annualRatePct !== after.annualRatePct) {
    lines.push(`Rate ${before.annualRatePct}% → ${after.annualRatePct}%`);
  }
  if (before.frequency !== after.frequency) {
    lines.push(`${frequencyMeta(before.frequency).label} → ${frequencyMeta(after.frequency).label}`);
  }
  return lines;
}

export type PaymentKind = "origin" | "scheduled" | "extra" | "terms";

export type PaymentPoint = {
  index: number;
  date: Date;
  payment: number;
  interest: number;
  principalPaid: number;
  balance: number;
  cumulativeInterest: number;
  remainingInterest: number;
  days: number;
  kind: PaymentKind;
  note: string;
  scheduledNumber: number | null;
  rate: number;
  termsBefore?: TermSnapshot | null;
  termsAfter?: TermSnapshot | null;
  sourceId?: string;
  impact?: AmendmentImpact | null;
};

export type ExtraInput = {
  date: Date;
  amount: number;
  note?: string;
  id?: string;
  impact?: AmendmentImpact | null;
};

export type TermChangeInput = {
  date: Date;
  payment: number;
  annualRatePct: number;
  frequency: Frequency;
  note?: string;
  id?: string;
  impact?: AmendmentImpact | null;
};

export type LedgerSimInput = LoanInput & {
  extras?: ExtraInput[];
  termChanges?: TermChangeInput[];
};

export type LoanInput = {
  principal: number;
  annualRatePct: number;
  payment: number;
  frequency: Frequency;
  startDate: Date;
};

export type LoanResult = {
  points: PaymentPoint[];
  neverPaysOff: boolean;
  reason: "ok" | "payment_too_low" | "too_long";
  minPayment: number;
  firstPeriodDays: number;
  totalInterest: number;
  totalPaid: number;
  payoffDate: Date | null;
  paymentCount: number;
  annualOutlay: number;
};

const MAX_PAYMENTS = 52 * 40;

function interestOn(balance: number, annualRatePct: number, days: number): number {
  if (balance <= 0 || annualRatePct <= 0 || days <= 0) return 0;
  return roundCents(balance * (annualRatePct / 100) * (days / 365));
}

export function firstPeriodInterest(input: LoanInput): {
  days: number;
  interest: number;
  minPayment: number;
} {
  const first = paymentDate(input.startDate, 1, input.frequency);
  const days = daysBetween(input.startDate, first);
  const interest = interestOn(input.principal, input.annualRatePct, days);
  const minPayment = roundCents(Math.max(interest + 0.01, 0.01));
  return { days, interest, minPayment };
}

export function simulateLoan(input: LoanInput): LoanResult {
  const principal = roundCents(Math.max(0, input.principal));
  const payment = roundCents(Math.max(0, input.payment));
  const start = input.startDate;
  const { days: firstDays, minPayment } = firstPeriodInterest(input);
  const annualOutlay = roundCents(payment * frequencyMeta(input.frequency).perYear);

  const origin: PaymentPoint = {
    index: 0,
    date: new Date(start),
    payment: 0,
    interest: 0,
    principalPaid: 0,
    balance: principal,
    cumulativeInterest: 0,
    remainingInterest: 0,
    days: 0,
    kind: "origin",
    note: "",
    scheduledNumber: null,
    rate: input.annualRatePct,
  };

  if (principal <= 0) {
    return {
      points: [origin],
      neverPaysOff: false,
      reason: "ok",
      minPayment,
      firstPeriodDays: firstDays,
      totalInterest: 0,
      totalPaid: 0,
      payoffDate: start,
      paymentCount: 0,
      annualOutlay,
    };
  }

  if (payment < minPayment && input.annualRatePct > 0) {
    return {
      points: [origin],
      neverPaysOff: true,
      reason: "payment_too_low",
      minPayment,
      firstPeriodDays: firstDays,
      totalInterest: Number.POSITIVE_INFINITY,
      totalPaid: 0,
      payoffDate: null,
      paymentCount: 0,
      annualOutlay,
    };
  }

  const points: PaymentPoint[] = [origin];
  let balance = principal;
  let cumulativeInterest = 0;
  let prevDate = start;
  let stagnant = 0;

  for (let n = 1; n <= MAX_PAYMENTS && balance > 0; n += 1) {
    const date = paymentDate(start, n, input.frequency);
    const days = daysBetween(prevDate, date);
    const interest = interestOn(balance, input.annualRatePct, days);
    const due = roundCents(balance + interest);
    const paid = Math.min(payment, due);
    let principalPaid = roundCents(paid - interest);
    if (principalPaid < 0) {
      principalPaid = 0;
    }
    if (paid < due && principalPaid <= 0) {
      stagnant += 1;
      if (stagnant >= 2) {
        return {
          points: [origin],
          neverPaysOff: true,
          reason: "payment_too_low",
          minPayment: roundCents(interest + 0.01),
          firstPeriodDays: firstDays,
          totalInterest: Number.POSITIVE_INFINITY,
          totalPaid: 0,
          payoffDate: null,
          paymentCount: 0,
          annualOutlay,
        };
      }
    } else {
      stagnant = 0;
    }

    balance = roundCents(balance - principalPaid);
    if (balance < 0.005) balance = 0;
    cumulativeInterest = roundCents(cumulativeInterest + interest);

    points.push({
      index: n,
      date,
      payment: paid,
      interest,
      principalPaid,
      balance,
      cumulativeInterest,
      remainingInterest: 0,
      days,
      kind: "scheduled",
      note: "",
      scheduledNumber: n,
      rate: input.annualRatePct,
    });
    prevDate = date;
  }

  const paidOff = points[points.length - 1]?.balance === 0;
  if (!paidOff) {
    return {
      points: [origin],
      neverPaysOff: true,
      reason: "too_long",
      minPayment,
      firstPeriodDays: firstDays,
      totalInterest: Number.POSITIVE_INFINITY,
      totalPaid: 0,
      payoffDate: null,
      paymentCount: 0,
      annualOutlay,
    };
  }

  const totalInterest = cumulativeInterest;
  for (const point of points) {
    point.remainingInterest = roundCents(totalInterest - point.cumulativeInterest);
  }

  const last = points[points.length - 1];
  const paymentCount = points.length - 1;
  const totalPaid = roundCents(principal + totalInterest);

  return {
    points,
    neverPaysOff: false,
    reason: "ok",
    minPayment,
    firstPeriodDays: firstDays,
    totalInterest,
    totalPaid,
    payoffDate: last.date,
    paymentCount,
    annualOutlay,
  };
}

function eventTime(date: Date): number {
  return startOfLocalDay(date).getTime();
}

function neverPaysOffResult(
  origin: PaymentPoint,
  minPayment: number,
  firstPeriodDays: number,
  annualOutlay: number,
  reason: "payment_too_low" | "too_long",
): LoanResult {
  return {
    points: [origin],
    neverPaysOff: true,
    reason,
    minPayment,
    firstPeriodDays,
    totalInterest: Number.POSITIVE_INFINITY,
    totalPaid: 0,
    payoffDate: null,
    paymentCount: 0,
    annualOutlay,
  };
}

export function simulateLedger(input: LedgerSimInput): LoanResult {
  const principal = roundCents(Math.max(0, input.principal));
  const start = startOfLocalDay(input.startDate);
  let terms = {
    payment: roundCents(Math.max(0, input.payment)),
    annualRatePct: input.annualRatePct,
    frequency: input.frequency,
  };

  const pending = [
    ...(input.extras ?? []).map((extra) => ({
      kind: "extra" as const,
      id: extra.id ?? "",
      date: startOfLocalDay(extra.date),
      amount: roundCents(Math.max(0, extra.amount)),
      note: extra.note ?? "",
      payment: 0,
      annualRatePct: 0,
      frequency: terms.frequency,
      impact: extra.impact ?? null,
    })),
    ...(input.termChanges ?? []).map((change) => ({
      kind: "terms" as const,
      id: change.id ?? "",
      date: startOfLocalDay(change.date),
      amount: 0,
      note: change.note ?? "",
      payment: roundCents(Math.max(0, change.payment)),
      annualRatePct: change.annualRatePct,
      frequency: change.frequency,
      impact: change.impact ?? null,
    })),
  ]
    .filter((event) => eventTime(event.date) >= eventTime(start))
    .filter((event) => event.kind === "terms" || event.amount > 0)
    .sort((a, b) => {
      const delta = eventTime(a.date) - eventTime(b.date);
      if (delta !== 0) return delta;
      return (a.kind === "extra" ? 1 : 2) - (b.kind === "extra" ? 1 : 2);
    });

  const first = paymentDate(start, 1, terms.frequency);
  const firstDays = Math.max(1, differenceInCalendarDays(first, start));
  const minPayment = roundCents(
    Math.max(interestOn(principal, terms.annualRatePct, firstDays) + 0.01, 0.01),
  );
  const annualOutlay = roundCents(terms.payment * frequencyMeta(terms.frequency).perYear);

  const origin: PaymentPoint = {
    index: 0,
    date: new Date(start),
    payment: 0,
    interest: 0,
    principalPaid: 0,
    balance: principal,
    cumulativeInterest: 0,
    remainingInterest: 0,
    days: 0,
    kind: "origin",
    note: "",
    scheduledNumber: null,
    rate: terms.annualRatePct,
  };

  if (principal <= 0) {
    return {
      points: [origin],
      neverPaysOff: false,
      reason: "ok",
      minPayment,
      firstPeriodDays: firstDays,
      totalInterest: 0,
      totalPaid: 0,
      payoffDate: start,
      paymentCount: 0,
      annualOutlay,
    };
  }

  const points: PaymentPoint[] = [origin];
  let balance = principal;
  let cumulativeInterest = 0;
  let pendingInterest = 0;
  let prevDate = start;
  let anchor = start;
  let schedN = 1;
  let stagnant = 0;
  let cursor = 0;
  let index = 0;
  let scheduledCount = 0;

  for (let guard = 0; guard < MAX_PAYMENTS * 2 && balance > 0; guard += 1) {
    const schedDate = paymentDate(anchor, schedN, terms.frequency);
    const next = cursor < pending.length ? pending[cursor] : null;
    const schedTime = eventTime(schedDate);
    const nextTime = next ? eventTime(next.date) : Number.POSITIVE_INFINITY;
    const usePending = Boolean(next) && nextTime < schedTime;
    const pick = usePending && next ? next.kind : "scheduled";
    const eventDate = usePending && next ? next.date : schedDate;
    const days = Math.max(0, differenceInCalendarDays(eventDate, prevDate));
    const periodInterest = interestOn(balance, terms.annualRatePct, days);
    const interest = roundCents(pendingInterest + periodInterest);

    if (pick === "scheduled") {
      const due = roundCents(balance + interest);
      const paid = Math.min(terms.payment, due);
      let principalPaid = roundCents(paid - interest);
      if (principalPaid < 0) principalPaid = 0;
      if (paid < due && principalPaid <= 0) {
        stagnant += 1;
        if (stagnant >= 2) {
          return neverPaysOffResult(
            origin,
            roundCents(interest + 0.01),
            firstDays,
            annualOutlay,
            "payment_too_low",
          );
        }
      } else {
        stagnant = 0;
      }

      balance = roundCents(balance - principalPaid);
      if (balance < 0.005) balance = 0;
      cumulativeInterest = roundCents(cumulativeInterest + interest);
      pendingInterest = 0;
      scheduledCount += 1;
      index += 1;
      points.push({
        index,
        date: eventDate,
        payment: paid,
        interest,
        principalPaid,
        balance,
        cumulativeInterest,
        remainingInterest: 0,
        days,
        kind: "scheduled",
        note: "",
        scheduledNumber: scheduledCount,
        rate: terms.annualRatePct,
      });
      prevDate = eventDate;
      schedN += 1;
      continue;
    }

    if (pick === "extra" && next?.kind === "extra") {
      const due = roundCents(balance + interest);
      const paid = Math.min(next.amount, due);
      let principalPaid = roundCents(paid - interest);
      if (principalPaid < 0) principalPaid = 0;
      balance = roundCents(balance - principalPaid);
      if (balance < 0.005) balance = 0;
      cumulativeInterest = roundCents(cumulativeInterest + interest);
      pendingInterest = 0;
      stagnant = 0;
      index += 1;
      points.push({
        index,
        date: eventDate,
        payment: paid,
        interest,
        principalPaid,
        balance,
        cumulativeInterest,
        remainingInterest: 0,
        days,
        kind: "extra",
        note: next.note,
        scheduledNumber: null,
        rate: terms.annualRatePct,
        sourceId: next.id || undefined,
        impact: next.impact,
      });
      prevDate = eventDate;
      cursor += 1;
      continue;
    }

    if (pick === "terms" && next?.kind === "terms") {
      pendingInterest = interest;
      const before: TermSnapshot = { ...terms };
      const frequencyChanged = next.frequency !== terms.frequency;
      terms = {
        payment: next.payment,
        annualRatePct: next.annualRatePct,
        frequency: next.frequency,
      };
      if (frequencyChanged) {
        anchor = eventDate;
        schedN = 1;
      }
      index += 1;
      points.push({
        index,
        date: eventDate,
        payment: 0,
        interest: 0,
        principalPaid: 0,
        balance,
        cumulativeInterest,
        remainingInterest: 0,
        days,
        kind: "terms",
        note: next.note,
        scheduledNumber: null,
        rate: terms.annualRatePct,
        termsBefore: before,
        termsAfter: { ...terms },
        sourceId: next.id || undefined,
        impact: next.impact,
      });
      prevDate = eventDate;
      cursor += 1;
      stagnant = 0;
    }
  }

  const paidOff = points[points.length - 1]?.balance === 0;
  if (!paidOff) {
    return neverPaysOffResult(origin, minPayment, firstDays, annualOutlay, "too_long");
  }

  const totalInterest = cumulativeInterest;
  for (const point of points) {
    point.remainingInterest = roundCents(totalInterest - point.cumulativeInterest);
  }

  const last = points[points.length - 1];
  return {
    points,
    neverPaysOff: false,
    reason: "ok",
    minPayment,
    firstPeriodDays: firstDays,
    totalInterest,
    totalPaid: roundCents(principal + totalInterest),
    payoffDate: last.date,
    paymentCount: scheduledCount,
    annualOutlay: roundCents(terms.payment * frequencyMeta(terms.frequency).perYear),
  };
}

export function downsamplePoints(points: PaymentPoint[], max = 180): PaymentPoint[] {
  if (points.length <= max) return points;
  const last = points.length - 1;
  const keep = new Set<number>([0, last]);
  points.forEach((point, idx) => {
    if (point.kind === "extra" || point.kind === "terms") keep.add(idx);
  });
  const step = last / (max - 1);
  for (let i = 0; i < max; i += 1) keep.add(Math.round(i * step));
  return [...keep].sort((a, b) => a - b).map((idx) => points[idx]);
}

export type LoanPhase = "upcoming" | "active" | "paid";

export type AsOfStatus = {
  phase: LoanPhase;
  asOf: Date;
  lastPayment: PaymentPoint;
  nextPayment: PaymentPoint | null;
  paymentsMade: number;
  paymentsLeft: number;
  daysSinceLast: number;
  daysUntilNext: number | null;
  accruedInterest: number;
  owedToday: number;
  remainingPrincipal: number;
  remainingInterest: number;
};

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function pointKind(point: PaymentPoint): PaymentKind {
  return point.kind ?? (point.index === 0 ? "origin" : "scheduled");
}

export function isCashPoint(point: PaymentPoint): boolean {
  const kind = pointKind(point);
  return kind === "scheduled" || kind === "extra";
}

export function statusAsOf(result: LoanResult, annualRatePct: number, asOf: Date): AsOfStatus {
  const today = startOfLocalDay(asOf);
  const origin = result.points[0];
  const start = startOfLocalDay(origin.date);
  const scheduledMade = (through: Date) =>
    result.points.filter(
      (point) =>
        pointKind(point) === "scheduled" && startOfLocalDay(point.date) <= through,
    ).length;

  if (today < start) {
    const first = result.points.find((point) => isCashPoint(point)) ?? null;
    return {
      phase: "upcoming",
      asOf: today,
      lastPayment: origin,
      nextPayment: first,
      paymentsMade: 0,
      paymentsLeft: result.paymentCount,
      daysSinceLast: 0,
      daysUntilNext: first ? differenceInCalendarDays(startOfLocalDay(first.date), today) : null,
      accruedInterest: 0,
      owedToday: origin.balance,
      remainingPrincipal: origin.balance,
      remainingInterest: origin.remainingInterest,
    };
  }

  let last = origin;
  for (const point of result.points) {
    if (startOfLocalDay(point.date) <= today) last = point;
    else break;
  }

  const paymentsMade = scheduledMade(today);

  if (last.balance <= 0) {
    return {
      phase: "paid",
      asOf: today,
      lastPayment: last,
      nextPayment: null,
      paymentsMade,
      paymentsLeft: 0,
      daysSinceLast: differenceInCalendarDays(today, startOfLocalDay(last.date)),
      daysUntilNext: null,
      accruedInterest: 0,
      owedToday: 0,
      remainingPrincipal: 0,
      remainingInterest: 0,
    };
  }

  const next =
    result.points.find(
      (point) => startOfLocalDay(point.date) > today && isCashPoint(point),
    ) ?? null;
  const daysSinceLast = differenceInCalendarDays(today, startOfLocalDay(last.date));
  const rate = last.rate ?? annualRatePct;
  const accruedInterest = interestOn(last.balance, rate, daysSinceLast);

  return {
    phase: "active",
    asOf: today,
    lastPayment: last,
    nextPayment: next,
    paymentsMade,
    paymentsLeft: Math.max(0, result.paymentCount - paymentsMade),
    daysSinceLast,
    daysUntilNext: next ? differenceInCalendarDays(startOfLocalDay(next.date), today) : null,
    accruedInterest,
    owedToday: roundCents(last.balance + accruedInterest),
    remainingPrincipal: last.balance,
    remainingInterest: last.remainingInterest,
  };
}
