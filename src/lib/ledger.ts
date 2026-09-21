import {
  FREQUENCIES,
  describeTerms,
  parseISODate,
  simulateLedger,
  simulateLoan,
  toISODate,
  type Frequency,
  type LoanResult,
  type PaymentPoint,
} from "./loan.ts";
import { parseNoteSignatures, termsVersion, type NoteSignatures } from "./esign.ts";
import { compareResults, isAmendmentImpact, type AmendmentImpact } from "./impact.ts";

export type ExtraPayment = {
  id: string;
  seq: number;
  date: string;
  amount: number;
  note: string;
  impact?: AmendmentImpact | null;
};

export type TermChange = {
  id: string;
  seq: number;
  date: string;
  payment: number;
  annualRatePct: number;
  frequency: Frequency;
  note: string;
  impact?: AmendmentImpact | null;
};

export type Ledger = {
  title: string;
  lender: string;
  borrower: string;
  principal: number;
  startDate: string;
  struckOn: string;
  payment: number;
  annualRatePct: number;
  frequency: Frequency;
  extras: ExtraPayment[];
  termChanges: TermChange[];
  /** Present after an e-signed export. Missing on notes saved before e-sign. */
  signatures?: NoteSignatures | null;
};

export type TermSet = {
  payment: number;
  annualRatePct: number;
  frequency: Frequency;
};

function nextSeq(ledger: Ledger): number {
  return (
    Math.max(0, ...ledger.extras.map((item) => item.seq), ...ledger.termChanges.map((item) => item.seq)) + 1
  );
}

export function currentTerms(ledger: Ledger): TermSet {
  if (ledger.termChanges.length === 0) {
    return {
      payment: ledger.payment,
      annualRatePct: ledger.annualRatePct,
      frequency: ledger.frequency,
    };
  }
  const last = [...ledger.termChanges].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    return byDate !== 0 ? byDate : a.seq - b.seq;
  })[ledger.termChanges.length - 1];
  return {
    payment: last.payment,
    annualRatePct: last.annualRatePct,
    frequency: last.frequency,
  };
}

export function simulateNote(ledger: Ledger): LoanResult {
  return simulateLedger({
    principal: ledger.principal,
    startDate: parseISODate(ledger.startDate),
    payment: ledger.payment,
    annualRatePct: ledger.annualRatePct,
    frequency: ledger.frequency,
    extras: ledger.extras.map((extra) => ({
      id: extra.id,
      date: parseISODate(extra.date),
      amount: extra.amount,
      note: extra.note,
      impact: extra.impact,
    })),
    termChanges: ledger.termChanges.map((change) => ({
      id: change.id,
      date: parseISODate(change.date),
      payment: change.payment,
      annualRatePct: change.annualRatePct,
      frequency: change.frequency,
      note: change.note,
      impact: change.impact,
    })),
  });
}

export function originalNote(ledger: Ledger): LoanResult {
  return simulateLoan({
    principal: ledger.principal,
    startDate: parseISODate(ledger.startDate),
    payment: ledger.payment,
    annualRatePct: ledger.annualRatePct,
    frequency: ledger.frequency,
  });
}

export type TermPath = {
  id: string;
  label: string;
  points: PaymentPoint[];
};

export function priorTermPaths(ledger: Ledger): TermPath[] {
  const changes = [...ledger.termChanges].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    return byDate !== 0 ? byDate : a.seq - b.seq;
  });
  if (changes.length === 0) return [];
  const paths: TermPath[] = [];
  const original = originalNote(ledger);
  if (!original.neverPaysOff) {
    paths.push({
      id: "original",
      label: describeTerms({
        payment: ledger.payment,
        annualRatePct: ledger.annualRatePct,
        frequency: ledger.frequency,
      }),
      points: original.points,
    });
  }
  for (let i = 0; i < changes.length - 1; i += 1) {
    const change = changes[i];
    const slice: Ledger = {
      ...ledger,
      extras: ledger.extras.filter((extra) => extra.date <= change.date),
      termChanges: changes.slice(0, i + 1),
    };
    const sim = simulateNote(slice);
    if (sim.neverPaysOff) continue;
    paths.push({
      id: change.id,
      label: describeTerms(change),
      points: sim.points,
    });
  }
  return paths;
}

export function draftExtraPayment(
  ledger: Ledger,
  extra: { date: string; amount: number; note: string },
): Ledger {
  const seq = nextSeq(ledger);
  return {
    ...ledger,
    extras: [
      ...ledger.extras,
      {
        id: `extra-${seq}`,
        seq,
        date: extra.date,
        amount: extra.amount,
        note: extra.note.trim(),
      },
    ],
  };
}

export function addExtraPayment(
  ledger: Ledger,
  extra: { date: string; amount: number; note: string },
): Ledger {
  const next = draftExtraPayment(ledger, extra);
  const last = next.extras[next.extras.length - 1];
  return {
    ...next,
    extras: [
      ...next.extras.slice(0, -1),
      { ...last, impact: compareResults(simulateNote(ledger), simulateNote(next)) },
    ],
  };
}

export function draftTermChange(
  ledger: Ledger,
  change: { date: string; payment: number; annualRatePct: number; frequency: Frequency; note: string },
): Ledger {
  const seq = nextSeq(ledger);
  return {
    ...ledger,
    termChanges: [
      ...ledger.termChanges,
      {
        id: `terms-${seq}`,
        seq,
        date: change.date,
        payment: change.payment,
        annualRatePct: change.annualRatePct,
        frequency: change.frequency,
        note: change.note.trim(),
      },
    ],
  };
}

export function addTermChange(
  ledger: Ledger,
  change: { date: string; payment: number; annualRatePct: number; frequency: Frequency; note: string },
): Ledger {
  const next = draftTermChange(ledger, change);
  const last = next.termChanges[next.termChanges.length - 1];
  return {
    ...next,
    termChanges: [
      ...next.termChanges.slice(0, -1),
      { ...last, impact: compareResults(simulateNote(ledger), simulateNote(next)) },
    ],
  };
}

export function undoLastAmendment(ledger: Ledger): Ledger {
  const lastExtra = ledger.extras.reduce<ExtraPayment | null>(
    (best, item) => (best && best.seq > item.seq ? best : item),
    null,
  );
  const lastChange = ledger.termChanges.reduce<TermChange | null>(
    (best, item) => (best && best.seq > item.seq ? best : item),
    null,
  );
  if (!lastExtra && !lastChange) return ledger;
  const extraIsLast = lastExtra && (!lastChange || lastExtra.seq >= lastChange.seq);
  if (extraIsLast && lastExtra) {
    return { ...ledger, extras: ledger.extras.filter((item) => item.id !== lastExtra.id) };
  }
  if (lastChange) {
    return {
      ...ledger,
      termChanges: ledger.termChanges.filter((item) => item.id !== lastChange.id),
    };
  }
  return ledger;
}

export function amendmentCount(ledger: Ledger): number {
  return ledger.extras.length + ledger.termChanges.length;
}

export function isFrequency(value: string): value is Frequency {
  return FREQUENCIES.some((item) => item.id === value);
}

export function ledgerFromPayload(payload: {
  title?: string;
  lender?: string;
  borrower?: string;
  principal: number;
  annualRatePct: number;
  payment: number;
  frequency: Frequency;
  startDate: string;
  struckOn?: string;
  extras?: Array<{
    id?: string;
    seq?: number;
    date: string;
    amount: number;
    note?: string;
    impact?: AmendmentImpact | null;
  }>;
  termChanges?: Array<{
    id?: string;
    seq?: number;
    date: string;
    payment: number;
    annualRatePct: number;
    frequency: Frequency;
    note?: string;
    impact?: AmendmentImpact | null;
  }>;
  signatures?: unknown;
}): Ledger {
  const extras = (payload.extras ?? []).map((extra, index) => ({
    id: extra.id ?? `extra-${index + 1}`,
    seq: extra.seq ?? index + 1,
    date: extra.date,
    amount: extra.amount,
    note: extra.note ?? "",
    impact: isAmendmentImpact(extra.impact) ? extra.impact : null,
  }));
  const termChanges = (payload.termChanges ?? []).map((change, index) => ({
    id: change.id ?? `terms-${index + 1}`,
    seq: change.seq ?? extras.length + index + 1,
    date: change.date,
    payment: change.payment,
    annualRatePct: change.annualRatePct,
    frequency: change.frequency,
    note: change.note ?? "",
    impact: isAmendmentImpact(change.impact) ? change.impact : null,
  }));
  return {
    title: (payload.title ?? "").trim() || "Personal note",
    lender: payload.lender?.trim() ?? "",
    borrower: payload.borrower?.trim() ?? "",
    principal: payload.principal,
    startDate: payload.startDate,
    struckOn: payload.struckOn ?? toISODate(new Date()),
    payment: payload.payment,
    annualRatePct: payload.annualRatePct,
    frequency: payload.frequency,
    extras,
    termChanges,
    signatures: parseNoteSignatures(
      payload.signatures,
      termsVersion({
        payment: payload.payment,
        annualRatePct: payload.annualRatePct,
        frequency: payload.frequency,
        termChanges,
      }),
    ),
  };
}
