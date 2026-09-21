import { format } from "date-fns";
import { formatMoney, formatPct } from "./format.ts";
import { htmlThemeCss, isHtmlTheme, type HtmlTheme } from "./html-theme.ts";
import { describeImpact } from "./impact.ts";
import {
  currentTerms,
  isFrequency,
  ledgerFromPayload,
  priorTermPaths,
  type Ledger,
} from "./ledger.ts";
import {
  frequencyMeta,
  paymentDate,
  toISODate,
  type Frequency,
  type LoanResult,
  type PaymentKind,
  type TermSnapshot,
} from "./loan.ts";

export type StruckMeta = {
  title: string;
  lender: string;
  borrower: string;
};

export type StruckScheduleRow = {
  n: number;
  date: string;
  payment: number;
  interest: number;
  principalPaid: number;
  balance: number;
  remainingInterest: number;
  kind: PaymentKind;
  note: string;
  scheduledNumber: number | null;
  rate: number;
  termsBefore: TermSnapshot | null;
  termsAfter: TermSnapshot | null;
  impactHeadline: string;
  impactDetail: string;
  impactTone: string;
};

export type StruckPayload = {
  title: string;
  lender: string;
  borrower: string;
  principal: number;
  annualRatePct: number;
  payment: number;
  frequency: Frequency;
  frequencyLabel: string;
  startDate: string;
  payoffDate: string;
  struckOn: string;
  totalInterest: number;
  totalPaid: number;
  paymentCount: number;
  extras: Ledger["extras"];
  termChanges: Ledger["termChanges"];
  currentPayment: number;
  currentRate: number;
  currentFrequency: Frequency;
  currentFrequencyLabel: string;
  theme: HtmlTheme;
  originalSchedule: Array<{ date: string; balance: number }>;
  priorPaths: Array<{ id: string; label: string; points: Array<{ date: string; balance: number }> }>;
  schedule: StruckScheduleRow[];
};

export function buildStruckPayload(
  terms: {
    principal: number;
    annualRatePct: number;
    payment: number;
    frequency: Frequency;
    startDate: string;
  },
  result: LoanResult,
  meta: StruckMeta,
  struckOn = new Date(),
  theme: HtmlTheme = "paper",
): StruckPayload {
  return buildStruckPayloadFromLedger(
    ledgerFromPayload({
      ...terms,
      ...meta,
      struckOn: toISODate(struckOn),
      extras: [],
      termChanges: [],
    }),
    result,
    struckOn,
    theme,
  );
}

export function buildStruckPayloadFromLedger(
  ledger: Ledger,
  result: LoanResult,
  struckOn = new Date(),
  theme: HtmlTheme = "paper",
): StruckPayload {
  const live = currentTerms(ledger);
  const priors = priorTermPaths(ledger);
  return {
    title: ledger.title,
    lender: ledger.lender,
    borrower: ledger.borrower,
    principal: ledger.principal,
    annualRatePct: ledger.annualRatePct,
    payment: ledger.payment,
    frequency: ledger.frequency,
    frequencyLabel: frequencyMeta(ledger.frequency).label,
    startDate: ledger.startDate,
    payoffDate: result.payoffDate ? toISODate(result.payoffDate) : ledger.startDate,
    struckOn: toISODate(struckOn),
    totalInterest: result.totalInterest,
    totalPaid: result.totalPaid,
    paymentCount: result.paymentCount,
    extras: ledger.extras,
    termChanges: ledger.termChanges,
    currentPayment: live.payment,
    currentRate: live.annualRatePct,
    currentFrequency: live.frequency,
    currentFrequencyLabel: frequencyMeta(live.frequency).label,
    theme,
    originalSchedule: priors[0]
      ? priors[0].points.map((point) => ({ date: toISODate(point.date), balance: point.balance }))
      : [],
    priorPaths: priors.map((path) => ({
      id: path.id,
      label: path.label,
      points: path.points.map((point) => ({ date: toISODate(point.date), balance: point.balance })),
    })),
    schedule: result.points.map((point) => ({
      n: point.index,
      date: toISODate(point.date),
      payment: point.payment,
      interest: point.interest,
      principalPaid: point.principalPaid,
      balance: point.balance,
      remainingInterest: point.remainingInterest,
      kind: point.kind ?? (point.index === 0 ? "origin" : "scheduled"),
      note: point.note ?? "",
      scheduledNumber: point.kind === "scheduled" ? (point.scheduledNumber ?? point.index) : null,
      rate: point.rate ?? live.annualRatePct,
      termsBefore: point.termsBefore ?? null,
      termsAfter: point.termsAfter ?? null,
      impactHeadline: point.impact ? describeImpact(point.impact).headline : "",
      impactDetail: point.impact ? describeImpact(point.impact).detail : "",
      impactTone: point.impact ? describeImpact(point.impact).tone : "",
    })),
  };
}

export function struckFilename(title: string, when = new Date()): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const y = when.getFullYear();
  const m = String(when.getMonth() + 1).padStart(2, "0");
  const d = String(when.getDate()).padStart(2, "0");
  const hh = String(when.getHours()).padStart(2, "0");
  const mm = String(when.getMinutes()).padStart(2, "0");
  return `notoilloans-${slug || "note"}-${y}${m}${d}-${hh}${mm}.html`;
}

export function downloadStruckHtml(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "\x26amp;";
    if (ch === "<") return "\x26lt;";
    if (ch === ">") return "\x26gt;";
    if (ch === '"') return "\x26quot;";
    return "\x26#39;";
  });
}

function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function buildStruckHtml(payload: StruckPayload): string {
  const parties =
    payload.lender || payload.borrower
      ? [
          payload.lender ? `Lent by ${payload.lender}` : "",
          payload.borrower ? `Borrowed by ${payload.borrower}` : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : "A locked personal loan ledger";

  const live = currentTerms(
    ledgerFromPayload({
      title: payload.title,
      lender: payload.lender,
      borrower: payload.borrower,
      principal: payload.principal,
      annualRatePct: payload.annualRatePct,
      payment: payload.payment,
      frequency: payload.frequency,
      startDate: payload.startDate,
      extras: payload.extras ?? [],
      termChanges: payload.termChanges ?? [],
    }),
  );
  const current = payload.currentPayment
    ? {
        payment: payload.currentPayment,
        rate: payload.currentRate,
        frequencyLabel: payload.currentFrequencyLabel,
      }
    : {
        payment: live.payment,
        rate: live.annualRatePct,
        frequencyLabel: frequencyMeta(live.frequency).label,
      };
  const amended = (payload.extras?.length ?? 0) + (payload.termChanges?.length ?? 0) > 0;
  const termsLine = `${formatMoney(payload.principal)} at ${formatPct(payload.annualRatePct)} · originally ${formatMoney(payload.payment)} ${payload.frequencyLabel.toLowerCase()}`;
  const liveLine = amended
    ? `Now ${formatMoney(current.payment)} ${current.frequencyLabel.toLowerCase()} at ${formatPct(current.rate)}.`
    : `${formatMoney(payload.principal)} at ${formatPct(payload.annualRatePct)} · ${formatMoney(payload.payment)} ${payload.frequencyLabel.toLowerCase()}`;

  return `<!DOCTYPE html>
<html lang="en" data-theme="${escapeHtml(payload.theme || "paper")}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(payload.title)} · No Toil Loans</title>
  <style>
    ${htmlThemeCss()}
    * { box-sizing: border-box; border-color: var(--border); }
    html { -webkit-font-smoothing: antialiased; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--fg);
      font-family: var(--sans);
      line-height: 1.5;
    }
    h1, h2, h3 { font-family: var(--display); font-weight: 500; text-wrap: balance; letter-spacing: -0.02em; }
    .wrap { max-width: 52rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
    @media (min-width: 720px) { .wrap { padding: 2.5rem 1.5rem 4rem; } }
    .kicker { font-size: .7rem; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; color: var(--muted-fg); }
    .title { font-size: clamp(2rem, 5vw, 3rem); font-style: italic; margin: .25rem 0 .5rem; }
    .lede { color: var(--muted-fg); max-width: 36rem; }
    .hero {
      background: var(--card);
      border-radius: 2rem;
      padding: 1.25rem 1.35rem;
      box-shadow: var(--shadow);
      margin-top: 1.5rem;
    }
    .asof { font-size: .75rem; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--muted-fg); }
    .big { font-family: var(--display); font-size: clamp(2.2rem, 6vw, 3.4rem); margin: .2rem 0; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }
    .interest { color: var(--interest); }
    .ok { color: var(--ok); }
    .grid { display: grid; gap: .75rem; margin-top: 1rem; }
    @media (min-width: 640px) { .grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    .stat { background: var(--muted); border-radius: .75rem; padding: .85rem 1rem; }
    .stat dt { font-size: .75rem; color: var(--muted-fg); }
    .stat dd { margin: .2rem 0 0; font-weight: 600; font-variant-numeric: tabular-nums; }
    .hint { font-size: .75rem; color: var(--muted-fg); margin: .15rem 0 0; }
    .card {
      background: var(--card);
      border-radius: 2rem;
      padding: 1.25rem 1.35rem;
      box-shadow: var(--shadow);
      margin-top: 1rem;
    }
    .bar { height: .7rem; background: var(--muted); border-radius: 999px; overflow: hidden; }
    .bar > span { display: block; height: 100%; background: var(--primary); }
    .legend { display: flex; flex-wrap: wrap; gap: 1rem; font-size: .75rem; color: var(--muted-fg); margin-top: .75rem; }
    .dot { width: .5rem; height: .5rem; border-radius: 99px; display: inline-block; margin-right: .4rem; }
    .chart { width: 100%; height: 240px; margin-top: .75rem; }
    table { width: 100%; border-collapse: collapse; font-size: .875rem; font-variant-numeric: tabular-nums; }
    th { text-align: left; font-size: .7rem; letter-spacing: .08em; text-transform: uppercase; color: var(--muted-fg); font-weight: 600; padding: .6rem .5rem; }
    td { padding: .55rem .5rem; border-top: 1px solid rgba(28,25,20,.08); white-space: nowrap; }
    tr.paid td { color: var(--muted-fg); }
    tr.next { background: var(--muted); }
    tr.next td { color: var(--fg); font-weight: 600; }
    tr.extra td { font-style: italic; }
    .head { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }
    .theme-switch {
      flex-shrink: 0;
      min-height: 2.75rem;
      min-width: 5.5rem;
      border: 0;
      background: var(--muted);
      color: var(--fg);
      border-radius: 999px;
      padding: .2rem;
      font: inherit;
      display: inline-flex;
      align-items: center;
      position: relative;
    }
    .theme-switch span {
      width: 2.5rem;
      text-align: center;
      font-size: .75rem;
      position: relative;
      z-index: 1;
    }
    .theme-switch i {
      position: absolute;
      top: .2rem; left: .2rem;
      width: 2.5rem; height: 2.35rem;
      border-radius: 999px;
      background: var(--card);
      box-shadow: var(--shadow);
      transition: transform .2s ease;
    }
    html[data-theme="ink"] .theme-switch i { transform: translateX(2.5rem); }
    .years { display:flex; gap:.5rem; margin-top:.75rem; flex-wrap:wrap; }
    .year-btn {
      min-height: 2.75rem;
      border: 0;
      background: var(--muted);
      color: var(--fg);
      border-radius: .75rem;
      padding: 0 .9rem;
      font: inherit;
      font-size: .8rem;
    }
    .year-btn[aria-pressed="true"] { background: var(--primary); color: var(--primary-fg); }
    .mix { display:grid; gap:1rem; margin-top:.75rem; }
    @media (min-width:640px) { .mix { grid-template-columns: 1fr 1fr; } }
    .donut-wrap { display:flex; align-items:center; gap:1rem; margin-top:.75rem; }
    .donut {
      width: 4rem; height: 4rem; border-radius: 99px; padding: 6px; flex-shrink: 0;
    }
    .donut > span { display:block; width:100%; height:100%; border-radius:99px; background: var(--card); }
    .hbar { height:.7rem; background: var(--muted); border-radius:999px; overflow:hidden; display:flex; margin-top:.6rem; }
    .hbar > i { display:block; height:100%; }
    .log { display:flex; flex-direction:column; gap:.5rem; margin-top:.75rem; }
    .log-item {
      background: var(--muted);
      border-radius: .75rem;
      padding: .75rem .9rem;
      display:flex; flex-direction:column; gap:.2rem;
    }
    .log-item.next { outline: 1px solid var(--fg); background: var(--card); }
    .log-item.paid { opacity:.72; }
    .log-top { display:flex; justify-content:space-between; gap:.75rem; font-size:.875rem; }
    .log-meta { font-size:.75rem; color: var(--muted-fg); display:flex; flex-wrap:wrap; gap:.75rem; }
    .pager { display:flex; justify-content:space-between; align-items:center; gap:.75rem; margin-top:.75rem; }
    .pager button {
      min-height: 2.75rem; min-width: 2.75rem;
      border: 1px solid var(--border);
      background: var(--muted); color: var(--fg);
      border-radius: .75rem; font: inherit;
    }
    .event {
      display:flex; justify-content:space-between; gap:.75rem;
      padding: .7rem .9rem; background: var(--muted); border-radius: .75rem; font-size:.875rem;
    }
    .event b { color: var(--ok); }
    .impact { font-size: .8rem; margin-top: .2rem; }
    .impact.better { color: var(--ok); }
    .impact.worse { color: var(--interest); }
    .impact.mixed, .impact.same { color: var(--muted-fg); }
    .print-btn {
      min-height: 2.75rem;
      border: 1px solid var(--border);
      background: var(--muted);
      color: var(--fg);
      border-radius: .75rem;
      padding: 0 1rem;
      font: inherit;
      font-size: .8rem;
    }
    .agreement h2 { margin: 0 0 .35rem; }
    .agreement .lede { margin-top: 0; }
    .clauses { margin: 1rem 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 1rem; }
    .clauses li { font-size: .9rem; }
    .clauses strong { display: block; font-size: .8rem; letter-spacing: .04em; text-transform: uppercase; margin-bottom: .2rem; }
    .signs { display: grid; gap: 1.5rem; margin-top: 2rem; }
    @media (min-width: 640px) { .signs { grid-template-columns: 1fr 1fr; } }
    .sign-line { border-bottom: 1px solid var(--fg); height: 2.5rem; }
    .sign-meta { font-size: .8rem; color: var(--muted-fg); margin: .4rem 0 0; }
    .chart-wrap { position: relative; }
    .orig-legend { border-bottom: 1.5px dashed var(--muted-fg); width: 1.1rem; display:inline-block; margin-right:.35rem; vertical-align:middle; }
    .scroll { overflow-x: auto; border-radius: .75rem; background: var(--muted); }
    .terms { font-size: .875rem; color: var(--muted-fg); }
    .terms strong { color: var(--fg); font-weight: 600; }
    .stamp { margin-top: 1.5rem; font-size: .75rem; color: var(--muted-fg); }
    @media print {
      body { background: white; color: black; }
      .no-print, .theme-switch, .chart, .legend, .mix, .years, .log, details, #events { display: none !important; }
      .hero, .card { box-shadow: none; border: 1px solid #ddd; break-inside: avoid; }
      .agreement { page-break-before: always; box-shadow: none; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="head">
      <div>
        <p class="kicker">Struck ledger</p>
        <h1 class="title">${escapeHtml(payload.title)}</h1>
      </div>
      <button type="button" class="theme-switch no-print" id="theme-toggle" aria-label="Toggle paper or ink">
        <i></i><span>Paper</span><span>Ink</span>
      </button>
    </div>
    <p class="lede">${escapeHtml(parties)}. Scheduled deposits are assumed on time. Extra payments and term changes stay in the payment log. This file reads today's date to show what is still owed.</p>

    <section class="hero">
      <p class="asof" id="asof">As of today</p>
      <p class="big" id="owed">—</p>
      <p class="hint" id="owed-label">Principal remaining, plus interest accrued since the last payment.</p>
      <div class="grid three" id="hero-stats"></div>
    </section>

    <section class="card">
      <h2>The note</h2>
      <p class="terms">
        <strong>${escapeHtml(liveLine)}</strong><br />
        ${amended ? `${escapeHtml(termsLine)}<br />` : ""}Starts ${escapeHtml(formatLong(payload.startDate))} · last payment ${escapeHtml(formatLong(payload.payoffDate))} · ${payload.paymentCount} scheduled payments · ${escapeHtml(formatMoney(payload.totalInterest))} interest if paid as logged.
      </p>
      <div class="bar" style="margin-top:1rem"><span id="progress"></span></div>
      <p class="hint" id="progress-label"></p>
      <svg class="chart" id="chart" viewBox="0 0 640 240" preserveAspectRatio="none" aria-hidden="true"></svg>
      <div class="legend" id="legend">
        <span><i class="dot" style="background:var(--principal)"></i>Remaining principal</span>
        <span><i class="dot" style="background:var(--extra)"></i>Extra payment</span>
        <span><i class="dot" style="background:var(--interest)"></i>Today</span>
      </div>
    </section>

    <section class="card">
      <h2>Principal and interest</h2>
      <p class="hint">What has already gone to principal versus interest, and what is still left.</p>
      <div class="mix" id="mix"></div>
    </section>

    <section class="card">
      <h2>Payment log</h2>
      <p class="hint" id="schedule-hint">Pick a year. Monthly notes show about twelve payments.</p>
      <div id="events" style="display:flex;flex-direction:column;gap:.5rem;margin-top:.75rem"></div>
      <div id="years" class="years"></div>
      <div class="log" id="log"></div>
      <details style="margin-top:1rem">
        <summary class="hint" style="cursor:pointer">Full schedule</summary>
        <div class="scroll" style="margin-top:.75rem">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Payment</th>
                <th>Interest</th>
                <th>Principal</th>
                <th>Balance</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="rows"></tbody>
          </table>
        </div>
      </details>
    </section>

    ${agreementHtml(payload)}

    <p class="stamp no-print">Struck ${escapeHtml(formatLong(payload.struckOn))} with No Toil Loans. Interest is simple, actual days / 365, recalculated on the remaining balance after each payment. To record an extra payment or change terms, open this file in No Toil Loans.</p>
  </main>
  <script type="application/json" id="paydown-loan">${jsonForScript(payload)}</script>
  <script>
    const LOAN = ${jsonForScript(payload)};

    function parseISO(iso) {
      const p = iso.split("-").map(Number);
      return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
    }
    function toISO(d) {
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return d.getFullYear() + "-" + m + "-" + day;
    }
    function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
    function daysBetween(a, b) {
      return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
    }
    function roundCents(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
    function money(n) {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
    }
    function longDate(iso) {
      return parseISO(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    function interestOn(balance, rate, days) {
      if (balance <= 0 || rate <= 0 || days <= 0) return 0;
      return roundCents(balance * (rate / 100) * (days / 365));
    }

    function rowKind(row) {
      return row.kind || (row.n === 0 ? "origin" : "scheduled");
    }
    function isCash(row) {
      const kind = rowKind(row);
      return kind === "scheduled" || kind === "extra";
    }

    function statusAsOf(asOf) {
      const today = startOfDay(asOf);
      const origin = LOAN.schedule[0];
      const start = parseISO(origin.date);
      const scheduledMade = function (through) {
        return LOAN.schedule.filter(function (row) {
          return rowKind(row) === "scheduled" && parseISO(row.date) <= through;
        }).length;
      };
      if (today < start) {
        const first = LOAN.schedule.find(isCash) || null;
        return {
          phase: "upcoming",
          last: origin,
          next: first,
          paymentsMade: 0,
          paymentsLeft: LOAN.paymentCount,
          daysSinceLast: 0,
          daysUntilNext: first ? daysBetween(today, parseISO(first.date)) : null,
          accrued: 0,
          owed: origin.balance,
          remainingInterest: origin.remainingInterest
        };
      }
      let last = origin;
      for (const row of LOAN.schedule) {
        if (parseISO(row.date) <= today) last = row;
        else break;
      }
      const paymentsMade = scheduledMade(today);
      if (last.balance <= 0) {
        return {
          phase: "paid",
          last: last,
          next: null,
          paymentsMade: paymentsMade,
          paymentsLeft: 0,
          daysSinceLast: daysBetween(parseISO(last.date), today),
          daysUntilNext: null,
          accrued: 0,
          owed: 0,
          remainingInterest: 0
        };
      }
      const next = LOAN.schedule.find(function (row) {
        return parseISO(row.date) > today && isCash(row);
      }) || null;
      const daysSinceLast = daysBetween(parseISO(last.date), today);
      const rate = last.rate != null ? last.rate : (LOAN.currentRate != null ? LOAN.currentRate : LOAN.annualRatePct);
      const accrued = interestOn(last.balance, rate, daysSinceLast);
      return {
        phase: "active",
        last: last,
        next: next,
        paymentsMade: paymentsMade,
        paymentsLeft: Math.max(0, LOAN.paymentCount - paymentsMade),
        daysSinceLast: daysSinceLast,
        daysUntilNext: next ? daysBetween(today, parseISO(next.date)) : null,
        accrued: accrued,
        owed: roundCents(last.balance + accrued),
        remainingInterest: last.remainingInterest
      };
    }

    function paidThrough(last) {
      let interest = 0;
      let principal = 0;
      for (const row of LOAN.schedule) {
        if (row.n > last.n) break;
        interest += row.interest || 0;
        principal += row.principalPaid || 0;
      }
      return { interest: roundCents(interest), principal: roundCents(principal) };
    }

    function share(part, whole) {
      if (!whole) return 0;
      return Math.max(0, Math.min(100, (part / whole) * 100));
    }

    const logRows = LOAN.schedule.filter(function (row) { return row.n > 0; });
    const years = Array.from(new Set(logRows.map(function (row) { return parseISO(row.date).getFullYear(); }))).sort();
    let selectedYear = years[0];
    let yearPinned = false;

    function render() {
      const today = startOfDay(new Date());
      const s = statusAsOf(today);
      document.getElementById("asof").textContent = "As of " + today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const owedEl = document.getElementById("owed");
      const labelEl = document.getElementById("owed-label");
      if (s.phase === "paid") {
        owedEl.textContent = "Paid off";
        owedEl.className = "big ok";
        labelEl.textContent = "The last payment landed " + longDate(s.last.date) + ".";
      } else if (s.phase === "upcoming") {
        owedEl.textContent = money(s.owed);
        owedEl.className = "big";
        labelEl.textContent = "The note has not started. First payment is " + (s.next ? longDate(s.next.date) : "—") + ".";
      } else {
        owedEl.textContent = money(s.owed);
        owedEl.className = "big";
        labelEl.textContent = money(s.last.balance) + " principal remaining" +
          (s.accrued > 0 ? ", plus " + money(s.accrued) + " interest accrued over " + s.daysSinceLast + " day" + (s.daysSinceLast === 1 ? "" : "s") + "." : ".");
      }

      const paid = paidThrough(s.last);
      const stats = [];
      stats.push({ t: "Principal left", v: money(s.last.balance) });
      stats.push({
        t: "Paid so far",
        v: money(roundCents(paid.principal + paid.interest)),
        h: money(paid.principal) + " to principal · " + money(paid.interest) + " to interest"
      });
      if (s.phase === "paid") {
        stats.push({ t: "Next payment", v: "None" });
      } else if (s.next) {
        stats.push({
          t: "Next payment",
          v: money(s.next.payment),
          h: longDate(s.next.date) + (s.daysUntilNext === 0 ? " · today" : " · in " + s.daysUntilNext + " day" + (s.daysUntilNext === 1 ? "" : "s"))
        });
      }
      document.getElementById("hero-stats").innerHTML = stats.map(function (item) {
        return '<div class="stat"><dt>' + item.t + '</dt><dd>' + item.v + '</dd>' +
          (item.h ? '<p class="hint">' + item.h + '</p>' : '') + '</div>';
      }).join("");

      const pct = LOAN.paymentCount === 0 ? 100 : (s.paymentsMade / LOAN.paymentCount) * 100;
      document.getElementById("progress").style.width = Math.min(100, pct) + "%";
      document.getElementById("progress-label").textContent =
        s.paymentsMade + " of " + LOAN.paymentCount + " payments made · " + s.paymentsLeft + " remaining";

      const interestLeft = Math.max(0, (LOAN.totalInterest || 0) - paid.interest);
      renderMix(paid, s.last.balance, interestLeft);
      renderEvents();
      renderLog(s, today);
      renderFullTable(s);
      drawChart(s);
    }

    function renderMix(paid, principalLeft, interestLeft) {
      const mix = document.getElementById("mix");
      if (!mix) return;
      const paidTotal = paid.principal + paid.interest;
      const remainTotal = principalLeft + interestLeft;
      mix.innerHTML =
        panel("Paid so far", paidTotal, paid.principal, paid.interest, share(paid.principal, paidTotal)) +
        panel("Still remaining", remainTotal, principalLeft, interestLeft, share(principalLeft, remainTotal));
    }

    function panel(title, total, principalAmt, interestAmt, pPct) {
      return '<div><p class="hint">' + title + '</p><p class="stat" style="background:transparent;padding:0"><dd style="font-family:var(--display);font-size:1.6rem">' + money(total) + '</dd></p>' +
        '<div class="donut-wrap"><div class="donut" style="background:conic-gradient(var(--principal) 0 ' + pPct + '%, var(--interest) ' + pPct + '% 100%)"><span></span></div>' +
        '<div class="hint">To principal ' + money(principalAmt) + '<br/>To interest ' + money(interestAmt) + '</div></div>' +
        '<div class="hbar"><i style="width:' + pPct + '%;background:var(--principal)"></i><i style="width:' + (100 - pPct) + '%;background:var(--interest)"></i></div></div>';
    }

    function describeChange(before, after) {
      if (!before || !after) return "";
      const labels = { weekly: "Weekly", biweekly: "Every 2 weeks", semimonthly: "Twice a month", monthly: "Monthly" };
      const lines = [];
      if (before.payment !== after.payment) {
        lines.push("Payment $" + Number(before.payment).toFixed(2) + " → $" + Number(after.payment).toFixed(2));
      }
      if (before.annualRatePct !== after.annualRatePct) {
        lines.push("Rate " + before.annualRatePct + "% → " + after.annualRatePct + "%");
      }
      if (before.frequency !== after.frequency) {
        lines.push((labels[before.frequency] || before.frequency) + " → " + (labels[after.frequency] || after.frequency));
      }
      return lines.join("<br/>");
    }

    function termCopy(row) {
      const changed = describeChange(row.termsBefore, row.termsAfter);
      if (changed) return changed + (row.note ? "<br/>" + row.note : "");
      return row.note || "Terms changed";
    }

    function renderEvents() {
      const el = document.getElementById("events");
      const events = logRows.filter(function (row) {
        const kind = rowKind(row);
        return kind === "extra" || kind === "terms";
      });
      el.innerHTML = events.map(function (row) {
        const extra = rowKind(row) === "extra";
        return '<div class="event"><span><b>' + (extra ? "Extra payment" : "Terms changed") + '</b> · ' +
          longDate(row.date) + (extra ? "" : '<br/><span class="hint">' + termCopy(row) + "</span>") +
          (row.impactHeadline ? '<br/><span class="impact ' + (row.impactTone || "") + '">' + row.impactHeadline + "</span>" : "") +
          (row.impactDetail ? '<br/><span class="hint">' + row.impactDetail + "</span>" : "") +
          '</span><span>' + (extra ? money(row.payment) : "") + "</span></div>";
      }).join("");
    }

    function renderYears(s) {
      const el = document.getElementById("years");
      if (!yearPinned && s.next) {
        selectedYear = parseISO(s.next.date).getFullYear();
        yearPinned = true;
      }
      if (years.indexOf(selectedYear) < 0) selectedYear = years[0];
      el.innerHTML = years.map(function (year) {
        const count = logRows.filter(function (row) { return parseISO(row.date).getFullYear() === year; }).length;
        const on = year === selectedYear;
        return '<button type="button" class="year-btn" data-year="' + year + '" aria-pressed="' + on + '">' +
          year + " · " + count + "</button>";
      }).join("");
    }

    function renderLog(s, today) {
      renderYears(s);
      const slice = logRows.filter(function (row) { return parseISO(row.date).getFullYear() === selectedYear; });
      document.getElementById("log").innerHTML = slice.map(function (row) {
        const kind = rowKind(row);
        const label = kind === "scheduled" ? (row.scheduledNumber != null ? "#" + row.scheduledNumber : "#" + row.n) : (kind === "extra" ? "Extra" : "Terms");
        let klass = "log-item";
        let tag = "";
        if (parseISO(row.date) <= today && isCash(row)) { klass += " paid"; tag = "Paid"; }
        if (s.next && row.n === s.next.n) { klass = "log-item next"; tag = s.daysUntilNext === 0 ? "Due today" : "Next"; }
        return '<div class="' + klass + '"><div class="log-top"><span>' + label + " · " + longDate(row.date) + "</span><span>" +
          (kind === "terms" ? "" : money(row.payment)) + '</span></div><div class="log-meta">' +
          (kind === "terms" ? "<span>" + termCopy(row) + "</span>" : "<span>Interest " + money(row.interest) + "</span><span>Principal " + money(row.principalPaid) + "</span><span>Balance " + money(row.balance) + "</span>") +
          (tag ? "<span>" + tag + "</span>" : "") + "</div>" +
          (row.impactHeadline ? '<div class="impact ' + (row.impactTone || "") + '">' + row.impactHeadline + "</div>" : "") +
          "</div>";
      }).join("");
    }

    function renderFullTable(s) {
      const rows = document.getElementById("rows");
      rows.innerHTML = logRows.map(function (row) {
        const kind = rowKind(row);
        let klass = "";
        let tag = "";
        const label = kind === "scheduled"
          ? (row.scheduledNumber != null ? row.scheduledNumber : row.n)
          : kind === "extra" ? "Extra" : "Terms";
        if (s.phase === "paid" || parseISO(row.date) <= startOfDay(new Date())) {
          if (isCash(row)) { klass = "paid"; tag = "Paid"; }
          else if (kind === "terms") { klass = "paid"; tag = "Logged"; }
        }
        if (s.next && row.n === s.next.n) { klass = "next"; tag = s.daysUntilNext === 0 ? "Due today" : "Next"; }
        if (kind === "extra") klass += " extra";
        return '<tr class="' + klass + '"><td>' + label + '</td><td>' + longDate(row.date) + '</td><td>' +
          (kind === "terms" ? (row.note || "Terms") : money(row.payment)) + '</td><td class="interest">' + money(row.interest) + '</td><td>' +
          money(row.principalPaid) + '</td><td>' + money(row.balance) + '</td><td>' + tag + '</td></tr>';
      }).join("");
    }

    function drawChart(s) {
      const svg = document.getElementById("chart");
      const data = LOAN.schedule;
      if (!data.length) return;
      const origs = (LOAN.priorPaths && LOAN.priorPaths.length)
        ? LOAN.priorPaths
        : (LOAN.originalSchedule && LOAN.originalSchedule.length ? [{ label: "Original", points: LOAN.originalSchedule }] : []);
      const allBal = data.map(function (r) { return r.balance; });
      origs.forEach(function (path) {
        path.points.forEach(function (r) { allBal.push(r.balance); });
      });
      const maxB = Math.max.apply(null, allBal) || 1;
      const start = parseISO(data[0].date).getTime();
      const liveEnd = parseISO(data[data.length - 1].date).getTime();
      let end = liveEnd;
      origs.forEach(function (path) {
        if (path.points.length) {
          const t = parseISO(path.points[path.points.length - 1].date).getTime();
          if (t > end) end = t;
        }
      });
      const span = Math.max(end - start, 1);
      const w = 640, h = 240, pad = 28, padT = 40;
      function xAt(iso) {
        return pad + ((parseISO(iso).getTime() - start) / span) * (w - pad * 2);
      }
      function y(v) { return h - pad - (v / maxB) * (h - pad - padT); }
      function pathFor(rows, key) {
        let d = "";
        rows.forEach(function (row, i) {
          d += (i === 0 ? "M" : "L") + xAt(row.date).toFixed(1) + " " + y(row[key]).toFixed(1) + " ";
        });
        return d;
      }
      const d = pathFor(data, "balance");
      const area = d + " L" + xAt(data[data.length - 1].date).toFixed(1) + " " + y(0).toFixed(1) +
        " L" + xAt(data[0].date).toFixed(1) + " " + y(0).toFixed(1) + " Z";
      const todayIso = data.find(function (row) { return row.n === s.last.n; }) || data[0];
      const tx = xAt(todayIso.date);
      const dashes = ["6 5", "3 4", "8 3 2 3", "2 3"];
      let html = '<path d="' + area + '" fill="var(--principal)" opacity="0.12"></path>' +
        '<path d="' + d + '" fill="none" stroke="var(--principal)" stroke-width="2.5"></path>';
      origs.forEach(function (path, i) {
        html += '<path d="' + pathFor(path.points, "balance") + '" fill="none" stroke="var(--muted-fg)" stroke-width="1.75" stroke-dasharray="' + (dashes[i] || "6 5") + '"></path>';
      });
      html += '<line x1="' + tx.toFixed(1) + '" x2="' + tx.toFixed(1) + '" y1="' + padT + '" y2="' + (h - pad) + '" stroke="var(--interest)" stroke-dasharray="4 4"></line>' +
        '<circle cx="' + tx.toFixed(1) + '" cy="' + y(todayIso.balance).toFixed(1) + '" r="4.5" fill="var(--interest)"></circle>';
      data.forEach(function (row) {
        if (rowKind(row) === "extra") {
          const cx = xAt(row.date);
          const cy = y(row.balance);
          const label = money(row.payment);
          const width = Math.max(58, label.length * 7.2 + 16);
          html += '<line x1="' + cx.toFixed(1) + '" y1="12" x2="' + cx.toFixed(1) + '" y2="' + cy.toFixed(1) + '" stroke="var(--extra)" stroke-width="2"></line>' +
            '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="6.5" fill="var(--extra)" stroke="var(--card)" stroke-width="3"></circle>' +
            '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="2.2" fill="var(--card)"></circle>' +
            '<rect x="' + (cx + 9).toFixed(1) + '" y="8" width="' + width + '" height="20" rx="6" fill="var(--extra)"></rect>' +
            '<polygon points="' + (cx + 9).toFixed(1) + ',12 ' + (cx + 2).toFixed(1) + ',18 ' + (cx + 9).toFixed(1) + ',24" fill="var(--extra)"></polygon>' +
            '<text x="' + (cx + 9 + width / 2).toFixed(1) + '" y="22" text-anchor="middle" fill="var(--card)" font-size="11" font-weight="700">' + label + "</text>";
        }
      });
      svg.innerHTML = html;
      const legend = document.getElementById("legend");
      if (legend) {
        let legendHtml = '<span><i class="dot" style="background:var(--principal)"></i>Remaining principal</span>' +
          '<span><i class="dot" style="background:var(--extra)"></i>Extra payment</span>' +
          '<span><i class="dot" style="background:var(--interest)"></i>Today</span>';
        origs.forEach(function (path) {
          legendHtml += '<span><i class="orig-legend"></i>' + (path.label || "Earlier terms") + "</span>";
        });
        legend.innerHTML = legendHtml;
      }
    }

    document.getElementById("theme-toggle").addEventListener("click", function () {
      const current = document.documentElement.getAttribute("data-theme") || "paper";
      const next = current === "ink" ? "paper" : "ink";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("paydown-html-theme", next); } catch (err) {}
    });
    document.getElementById("years").addEventListener("click", function (e) {
      const btn = e.target.closest("[data-year]");
      if (!btn) return;
      selectedYear = Number(btn.getAttribute("data-year"));
      yearPinned = true;
      render();
    });
    try {
      const saved = localStorage.getItem("paydown-html-theme");
      if (saved === "ink" || saved === "paper") document.documentElement.setAttribute("data-theme", saved);
    } catch (err) {}

    render();
  </script>
</body>
</html>`;
}

function formatLong(iso: string): string {
  return format(parseISODateSafe(iso), "MMM d, yyyy");
}

function parseISODateSafe(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function agreementHtml(payload: StruckPayload): string {
  const lenderName = payload.lender.trim();
  const borrowerName = payload.borrower.trim();
  const lender = lenderName || "Lender";
  const borrower = borrowerName || "Borrower";
  const freq = (payload.currentFrequencyLabel || payload.frequencyLabel).toLowerCase();
  const payment = formatMoney(payload.currentPayment || payload.payment);
  const rate = formatPct(payload.currentRate != null ? payload.currentRate : payload.annualRatePct);
  const first = payload.schedule.find((row) => row.kind === "scheduled");
  const firstDate = first
    ? formatLong(first.date)
    : formatLong(
        toISODate(
          paymentDate(
            parseISODateSafe(payload.startDate),
            1,
            payload.currentFrequency || payload.frequency,
          ),
        ),
      );
  return `
    <section class="card agreement" id="agreement">
      <div class="head" style="margin-bottom:1rem">
        <div>
          <p class="kicker">Promissory note</p>
          <h2>${escapeHtml(payload.title)}</h2>
          <p class="lede">Print this page. Both parties sign. Keep it with the ledger file.</p>
        </div>
        <button type="button" class="print-btn no-print" onclick="window.print()">Print agreement</button>
      </div>
      <p>
        This note is made on ${escapeHtml(formatLong(payload.struckOn))} between
        <strong>${escapeHtml(lender)}</strong> (“Lender”) and
        <strong>${escapeHtml(borrower)}</strong> (“Borrower”).
      </p>
      <ol class="clauses">
        <li>
          <strong>1. Principal</strong>
          Lender lends Borrower ${escapeHtml(formatMoney(payload.principal))}. Borrower promises to repay that principal plus interest as set out here.
        </li>
        <li>
          <strong>2. Interest</strong>
          Interest is simple — not compounded — at ${escapeHtml(rate)} per year. It is calculated on remaining principal only, using the actual number of days since the last payment (or since ${escapeHtml(formatLong(payload.startDate))}) over a 365-day year (“actual/365”). Interest is figured when a payment lands, scheduled or extra. That payment covers accrued interest first, then principal. After every payment, remaining interest and the payoff date are recalculated on the new balance. This is not bank amortization.
        </li>
        <li>
          <strong>3. Regular payments</strong>
          Borrower pays ${escapeHtml(payment)} ${escapeHtml(freq)}, by direct deposit unless the parties agree otherwise. The first payment is due ${escapeHtml(firstDate)}. Regular deposits are assumed on time. A payment larger than remaining principal plus accrued interest pays the note in full.
        </li>
        <li>
          <strong>4. Extra payments</strong>
          Borrower may make an extra payment of any amount on any date, without penalty. Extra money is applied the same way: accrued interest first, then principal. The moment an extra payment lands, remaining interest and the payoff date are recalculated on the new balance. Extra payments are logged in this file, including the change in payoff time and interest.
        </li>
        <li>
          <strong>5. Changes to terms</strong>
          The parties may agree to a new payment amount, interest rate, or frequency from a stated date forward. History through that date stays as logged. Each change is recorded in this file with its effect on the life of the loan and the interest paid.
        </li>
        <li>
          <strong>6. Prepayment</strong>
          Borrower may pay remaining principal plus accrued interest in full at any time without penalty.
        </li>
        <li>
          <strong>7. Record</strong>
          This file is the payment log for the note. Opening it on a given day shows the amount still owed as of that date. To log an extra payment or a change of terms, open this file in No Toil Loans and export an updated copy.
        </li>
      </ol>
      <div class="signs">
        <div>
          <div class="sign-line"></div>
          <p class="sign-meta">Lender${lenderName ? ` · ${escapeHtml(lenderName)}` : ""}</p>
          <div class="sign-line" style="height:1.75rem"></div>
          <p class="sign-meta">Date</p>
        </div>
        <div>
          <div class="sign-line"></div>
          <p class="sign-meta">Borrower${borrowerName ? ` · ${escapeHtml(borrowerName)}` : ""}</p>
          <div class="sign-line" style="height:1.75rem"></div>
          <p class="sign-meta">Date</p>
        </div>
      </div>
    </section>`;
}

export function parseStruckHtml(html: string): StruckPayload | null {
  const tagged = html.match(/<script[^>]*id=["']paydown-loan["'][^>]*>([\s\S]*?)<\/script>/i);
  const raw = tagged?.[1]?.trim() ?? html.match(/const LOAN = (\{[\s\S]*?\});/)?.[1];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StruckPayload>;
    if (
      typeof parsed.principal !== "number" ||
      typeof parsed.payment !== "number" ||
      typeof parsed.annualRatePct !== "number" ||
      typeof parsed.startDate !== "string" ||
      !parsed.frequency ||
      !isFrequency(parsed.frequency)
    ) {
      return null;
    }
    const extras = Array.isArray(parsed.extras) ? parsed.extras : [];
    const termChanges = Array.isArray(parsed.termChanges) ? parsed.termChanges : [];
    const live = currentTerms(
      ledgerFromPayload({
        title: parsed.title ?? "Personal note",
        lender: parsed.lender ?? "",
        borrower: parsed.borrower ?? "",
        principal: parsed.principal,
        annualRatePct: parsed.annualRatePct,
        payment: parsed.payment,
        frequency: parsed.frequency,
        startDate: parsed.startDate,
        struckOn: parsed.struckOn,
        extras,
        termChanges,
      }),
    );
    return {
      title: (parsed.title ?? "Personal note").trim() || "Personal note",
      lender: parsed.lender ?? "",
      borrower: parsed.borrower ?? "",
      principal: parsed.principal,
      annualRatePct: parsed.annualRatePct,
      payment: parsed.payment,
      frequency: parsed.frequency,
      frequencyLabel: parsed.frequencyLabel ?? frequencyMeta(parsed.frequency).label,
      startDate: parsed.startDate,
      payoffDate: parsed.payoffDate ?? parsed.startDate,
      struckOn: parsed.struckOn ?? parsed.startDate,
      totalInterest: parsed.totalInterest ?? 0,
      totalPaid: parsed.totalPaid ?? parsed.principal,
      paymentCount: parsed.paymentCount ?? 0,
      extras,
      termChanges,
      currentPayment: parsed.currentPayment ?? live.payment,
      currentRate: parsed.currentRate ?? live.annualRatePct,
      currentFrequency: parsed.currentFrequency ?? live.frequency,
      currentFrequencyLabel: parsed.currentFrequencyLabel ?? frequencyMeta(live.frequency).label,
      theme: isHtmlTheme(parsed.theme) ? parsed.theme : "paper",
      originalSchedule: Array.isArray(parsed.originalSchedule) ? parsed.originalSchedule : [],
      priorPaths: Array.isArray(parsed.priorPaths) ? parsed.priorPaths : [],
      schedule: Array.isArray(parsed.schedule) ? (parsed.schedule as StruckPayload["schedule"]) : [],
    };
  } catch {
    return null;
  }
}
