import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, FolderOpen, Info, RotateCcw } from "lucide-react";
import { ActiveLedger } from "@/components/active-ledger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { SliderField } from "@/components/slider-field";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PayoffChart } from "@/components/payoff-chart";
import { PaymentSchedule } from "@/components/payment-schedule";
import { AsOfStatus } from "@/components/as-of-status";
import { LoanMix } from "@/components/loan-mix";
import { StrikeLoan } from "@/components/strike-loan";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_DISPLAY } from "@/lib/brand";
import { formatCount, formatMoney, formatPct } from "@/lib/format";
import { ledgerFromPayload, type Ledger } from "@/lib/ledger";
import {
  FREQUENCIES,
  frequencyMeta,
  parseISODate,
  simulateLoan,
  toISODate,
  type Frequency,
  type PaymentPoint,
} from "@/lib/loan";
import { parseStruckHtml } from "@/lib/struck-html";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "paydown:v1";
const LEDGER_KEY = "paydown:active-ledger:v1";

type Draft = {
  principal: number;
  rate: number;
  payment: number;
  frequency: Frequency;
  startDate: string;
};

const DEFAULTS: Draft = {
  principal: 5000,
  rate: 6,
  payment: 200,
  frequency: "monthly",
  startDate: "2026-09-17",
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function loadDraft(): Draft {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS, startDate: toISODate(new Date()) };
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return {
      principal: clamp(Number(parsed.principal) || DEFAULTS.principal, 1, 1_000_000),
      rate: clamp(Number(parsed.rate) ?? DEFAULTS.rate, 0, 49),
      payment: clamp(Number(parsed.payment) || DEFAULTS.payment, 1, 1_000_000),
      frequency: FREQUENCIES.some((f) => f.id === parsed.frequency)
        ? (parsed.frequency as Frequency)
        : DEFAULTS.frequency,
      startDate: typeof parsed.startDate === "string" ? parsed.startDate : toISODate(new Date()),
    };
  } catch {
    return { ...DEFAULTS, startDate: toISODate(new Date()) };
  }
}

function pointAt(points: PaymentPoint[], index: number): PaymentPoint {
  return points.find((p) => p.index === index) ?? points[0];
}

export function LoanCalculator() {
  const [draft, setDraft] = useState<Draft>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [principalText, setPrincipalText] = useState(String(DEFAULTS.principal));
  const [rateText, setRateText] = useState(String(DEFAULTS.rate));
  const [paymentText, setPaymentText] = useState(String(DEFAULTS.payment));
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loaded = loadDraft();
    setDraft(loaded);
    setPrincipalText(String(loaded.principal));
    setRateText(String(loaded.rate));
    setPaymentText(String(loaded.payment));
    try {
      const raw = window.localStorage.getItem(LEDGER_KEY);
      if (raw) setLedger(JSON.parse(raw) as Ledger);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (ledger) window.localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
    else window.localStorage.removeItem(LEDGER_KEY);
  }, [ledger, hydrated]);

  const result = useMemo(
    () =>
      simulateLoan({
        principal: draft.principal,
        annualRatePct: draft.rate,
        payment: draft.payment,
        frequency: draft.frequency,
        startDate: parseISODate(draft.startDate),
      }),
    [draft],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [draft.principal, draft.rate, draft.payment, draft.frequency, draft.startDate]);

  const selected = pointAt(result.points, selectedIndex);
  const paymentsLeft = result.neverPaysOff
    ? null
    : Math.max(0, result.paymentCount - selected.index);
  const freq = frequencyMeta(draft.frequency);
  const paymentSliderMax = Math.max(500, Math.round(draft.principal), draft.payment);

  function setPrincipal(n: number) {
    const principal = clamp(roundInput(n), 1, 1_000_000);
    setDraft((d) => ({ ...d, principal }));
    setPrincipalText(String(principal));
  }

  function setRate(n: number) {
    const rate = clamp(Math.round(n * 100) / 100, 0, 49);
    setDraft((d) => ({ ...d, rate }));
    setRateText(String(rate));
  }

  function setPayment(n: number) {
    const payment = clamp(roundInput(n), 1, 1_000_000);
    setDraft((d) => ({ ...d, payment }));
    setPaymentText(String(payment));
  }

  function reset() {
    const next = { ...DEFAULTS, startDate: toISODate(new Date()) };
    setDraft(next);
    setPrincipalText(String(next.principal));
    setRateText(String(next.rate));
    setPaymentText(String(next.payment));
    setSelectedIndex(0);
  }

  function openStruckFile(file: File) {
    void file.text().then((text) => {
      const payload = parseStruckHtml(text);
      if (!payload) {
        setOpenError("That file is not a No Toil Loans note.");
        return;
      }
      setOpenError(null);
      setLedger(ledgerFromPayload(payload));
    });
  }

  if (ledger) {
    return (
      <TooltipProvider>
        <ActiveLedger
          ledger={ledger}
          onChange={setLedger}
          onClose={() => {
            setLedger(null);
            setOpenError(null);
          }}
        />
      </TooltipProvider>
    );
  }

  const remainingInterest = result.neverPaysOff
    ? Number.POSITIVE_INFINITY
    : selected.remainingInterest;
  const remainingCost = result.neverPaysOff
    ? Number.POSITIVE_INFINITY
    : selected.balance + selected.remainingInterest;

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
              Friendly loan ledger
            </p>
            <h1 className="mt-1 font-display text-4xl font-medium tracking-tight text-foreground italic md:text-5xl">
              {APP_DISPLAY}
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Dial in the terms, then strike the note. Bring that file back later to log extra
              payments or new terms — history through that date stays, and you can export again.
            </p>
            {openError ? <p className="mt-2 text-sm text-destructive">{openError}</p> : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              id="open-note"
              ref={fileRef}
              type="file"
              accept=".html,text/html"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) openStruckFile(file);
              }}
            />
            <Button variant="outline" type="button" onClick={() => fileRef.current?.click()}>
              <FolderOpen />
              Open a struck note
            </Button>
            <Button variant="outline" onClick={reset} type="button">
              <RotateCcw />
              Reset
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-3">
          <aside className="min-w-0 rounded-3xl bg-card p-5 shadow-ledger lg:sticky lg:top-6">
            <div className="rounded-md bg-muted px-4 py-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {selected.index === 0 ? "Interest you will pay" : "Interest still remaining"}
              </p>
              <p className="mt-1 font-display text-3xl font-medium tracking-tight text-interest tabular-nums">
                {result.neverPaysOff ? "Never" : formatMoney(remainingInterest)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {result.neverPaysOff
                  ? `Payment must be at least ${formatMoney(result.minPayment)} to cover interest.`
                  : selected.index === 0
                    ? `On top of the ${formatMoney(draft.principal)} you borrowed.`
                    : `After payment ${selected.index} of ${result.paymentCount}.`}
              </p>
            </div>

            <div className="mt-6 space-y-6">
              <SliderField
                id="amount"
                label="Amount borrowed"
                prefix="$"
                text={principalText}
                onText={setPrincipalText}
                onCommit={setPrincipal}
                value={draft.principal}
                min={100}
                max={50000}
                step={50}
                display={formatMoney(draft.principal)}
              />
              <SliderField
                id="rate"
                label="Interest rate"
                suffix="%"
                text={rateText}
                onText={setRateText}
                onCommit={setRate}
                value={draft.rate}
                min={0}
                max={25}
                step={0.05}
                display={formatPct(draft.rate)}
              />
              <SliderField
                id="payment"
                label="Payment"
                prefix="$"
                text={paymentText}
                onText={setPaymentText}
                onCommit={setPayment}
                value={draft.payment}
                min={1}
                max={paymentSliderMax}
                step={5}
                display={formatMoney(draft.payment)}
              />
            </div>

            <div className="mt-6">
              <Label>How often</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {FREQUENCIES.map((item) => {
                  const active = draft.frequency === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, frequency: item.id }))}
                      className={cn(
                        "min-h-14 rounded-md px-3 py-2.5 text-left transition-[background-color,color,box-shadow] duration-150 ease-out",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground hover:bg-secondary",
                      )}
                    >
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span
                        className={cn(
                          "block text-xs",
                          active ? "text-primary-foreground/70" : "text-muted-foreground",
                        )}
                      >
                        {item.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Every 2 weeks is 26 payments a year; twice a month is 24. Same dollar amount
                hits the balance more often on the 26-payment calendar.
              </p>
            </div>

            <div className="mt-6">
              <Label htmlFor="start">Start date</Label>
              <Input
                id="start"
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
                className="mt-2"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                First payment is one period later. About {formatMoney(result.annualOutlay)} a year
                at this payment.
              </p>
            </div>

            {result.neverPaysOff ? null : (
              <div className="mt-6">
                <AsOfStatus result={result} rate={draft.rate} />
              </div>
            )}

            <div className="mt-6">
              <StrikeLoan
                principal={draft.principal}
                rate={draft.rate}
                payment={draft.payment}
                frequency={draft.frequency}
                startDate={draft.startDate}
                result={result}
              />
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {result.neverPaysOff
                  ? "Raise the payment until it actually pays off, then lock the terms into a file."
                  : "Locks these terms into a file. Bring it back here later to log extra payments or change the terms."}
              </p>
            </div>
          </aside>

          <section className="min-w-0 space-y-6 lg:col-span-2">
            {result.neverPaysOff ? (
              <div className="flex gap-3 rounded-3xl bg-card p-5 shadow-ledger">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div>
                  <h2 className="font-medium">This payment never pays it off</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {result.reason === "too_long"
                      ? "It would take more than 40 years. Raise the payment or pay more often."
                      : `Each period adds about ${formatMoney(result.minPayment)} in interest before a payment lands. Pay more than that so the balance can fall.`}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat
                    label="Payoff date"
                    value={result.payoffDate ? format(result.payoffDate, "MMM d, yyyy") : "—"}
                  />
                  <Stat
                    label={selected.index === 0 ? "Payments" : "Payments left"}
                    value={
                      selected.index === 0
                        ? formatCount(result.paymentCount)
                        : formatCount(paymentsLeft ?? 0)
                    }
                  />
                  <Stat label="Total you'll hand over" value={formatMoney(result.totalPaid)} />
                </div>

                <div className="rounded-3xl bg-card p-5 shadow-ledger">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-xl font-medium tracking-tight">Payoff</h2>
                      <p className="mt-1 max-w-md text-sm text-muted-foreground">
                        The stack is remaining principal plus remaining interest. Both shrink
                        after every payment because interest is recalculated on what is left.
                      </p>
                    </div>
                    <Legend />
                  </div>

                  <div className="mt-4">
                    <PayoffChart
                      points={result.points}
                      selectedIndex={selected.index}
                      onSelect={setSelectedIndex}
                    />
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <Label htmlFor="progress">After payment</Label>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        {selected.index} / {result.paymentCount}
                      </p>
                    </div>
                    <Slider
                      id="progress"
                      min={0}
                      max={result.paymentCount}
                      step={1}
                      value={[selected.index]}
                      onValueChange={([v]) => setSelectedIndex(v ?? 0)}
                      aria-label="Payment progress"
                    />
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <Mini
                        label="This payment's interest"
                        value={selected.index === 0 ? "—" : formatMoney(selected.interest)}
                        hint={
                          selected.index === 0
                            ? "Origination — no payment yet"
                            : `${selected.days} days on the remaining balance`
                        }
                      />
                      <Mini
                        label="Balance left"
                        value={formatMoney(selected.balance)}
                        hint={
                          selected.index === 0 ? "What you borrowed" : "After this payment lands"
                        }
                      />
                      <Mini
                        label="Still to pay overall"
                        value={formatMoney(remainingCost)}
                        hint="Balance plus remaining interest"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-card p-5 shadow-ledger">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-xl font-medium tracking-tight">
                      Principal and interest
                    </h2>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                          aria-label="How interest is calculated"
                        >
                          <Info className="size-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Each payment first covers interest accrued since the last one, then the
                        rest knocks down principal. Next time, interest is smaller because the
                        balance is smaller.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="mt-4">
                    <LoanMix
                      principal={draft.principal}
                      point={selected}
                      totalInterest={result.totalInterest}
                    />
                  </div>
                </div>

                <div className="rounded-3xl bg-card p-5 shadow-ledger">
                  <div className="mb-4">
                    <h2 className="font-display text-xl font-medium tracking-tight">
                      Payment log
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {freq.label} · pick a year. Monthly notes show about twelve payments.
                    </p>
                  </div>
                  <PaymentSchedule
                    points={result.points}
                    selectedIndex={selected.index}
                    onSelect={setSelectedIndex}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </TooltipProvider>
  );
}

function roundInput(n: number) {
  return Math.round(n * 100) / 100;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-card px-5 py-4 shadow-ledger">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl font-medium tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md bg-muted px-3 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      <li className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-principal" />
        Remaining balance
      </li>
      <li className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-interest" />
        Remaining interest
      </li>
      <li className="flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-ok" />
        Extra payment
      </li>
    </ul>
  );
}
