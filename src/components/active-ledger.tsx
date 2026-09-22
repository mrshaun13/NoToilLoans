import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, Download, Mail, RotateCcw, Undo2 } from "lucide-react";
import { ESignApprove } from "@/components/esign-approve";
import { AsOfStatus } from "@/components/as-of-status";
import { ImpactCard } from "@/components/impact-card";
import { LoanMix } from "@/components/loan-mix";
import { PayoffChart } from "@/components/payoff-chart";
import { PaymentSchedule } from "@/components/payment-schedule";
import { SliderField } from "@/components/slider-field";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  exportNeedsLenderResign,
  openMailHandoff,
  signAsLender,
  signaturesMatchVersion,
  termsVersion,
} from "@/lib/esign";
import { formatCount, formatMoney, formatPct } from "@/lib/format";
import {
  addExtraPayment,
  addTermChange,
  amendmentCount,
  currentTerms,
  draftExtraPayment,
  draftTermChange,
  priorTermPaths,
  simulateNote,
  undoLastAmendment,
  type Ledger,
} from "@/lib/ledger";
import { compareResults } from "@/lib/impact";
import {
  FREQUENCIES,
  parseISODate,
  startOfLocalDay,
  toISODate,
  type Frequency,
  type PaymentPoint,
} from "@/lib/loan";
import {
  buildStruckHtml,
  buildStruckPayloadFromLedger,
  downloadStruckHtml,
  struckFilename,
} from "@/lib/struck-html";
import { cn } from "@/lib/utils";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function pointAt(points: PaymentPoint[], index: number): PaymentPoint {
  return points.find((point) => point.index === index) ?? points[0];
}

export function ActiveLedger({
  ledger,
  onChange,
  onClose,
}: {
  ledger: Ledger;
  onChange: (next: Ledger) => void;
  onClose: () => void;
}) {
  const result = useMemo(() => simulateNote(ledger), [ledger]);
  const overlays = useMemo(() => priorTermPaths(ledger), [ledger]);
  const live = currentTerms(ledger);
  const today = toISODate(new Date());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [extraDate, setExtraDate] = useState(today);
  const [extraAmount, setExtraAmount] = useState("");
  const [extraNote, setExtraNote] = useState("");
  const [changeDate, setChangeDate] = useState(today);
  const [changePayment, setChangePayment] = useState(live.payment);
  const [changeRate, setChangeRate] = useState(live.annualRatePct);
  const [changePaymentText, setChangePaymentText] = useState(String(live.payment));
  const [changeRateText, setChangeRateText] = useState(String(live.annualRatePct));
  const [changeFrequency, setChangeFrequency] = useState<Frequency>(live.frequency);
  const [changeNote, setChangeNote] = useState("");
  const [exportedHtml, setExportedHtml] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [mailFile, setMailFile] = useState<{ title: string; filename: string } | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [asOf, setAsOf] = useState<Date | null>(null);

  useEffect(() => {
    setAsOf(new Date());
  }, []);

  useEffect(() => {
    const now = startOfLocalDay(new Date());
    let last = 0;
    for (const point of result.points) {
      if (startOfLocalDay(point.date) <= now) last = point.index;
    }
    setSelectedIndex(last);
  }, [ledger, result.points]);

  useEffect(() => {
    setChangePayment(live.payment);
    setChangeRate(live.annualRatePct);
    setChangePaymentText(String(live.payment));
    setChangeRateText(String(live.annualRatePct));
    setChangeFrequency(live.frequency);
  }, [live.payment, live.annualRatePct, live.frequency]);

  const selected = pointAt(result.points, selectedIndex);
  const preview = useMemo(
    () =>
      draftTermChange(ledger, {
        date: changeDate || ledger.startDate,
        payment: changePayment,
        annualRatePct: changeRate,
        frequency: changeFrequency,
        note: changeNote,
      }),
    [ledger, changeDate, changePayment, changeRate, changeFrequency, changeNote],
  );
  const previewResult = useMemo(() => simulateNote(preview), [preview]);
  const paymentSliderMax = Math.max(500, Math.round(ledger.principal), changePayment, live.payment);
  const termsUnchanged =
    changePayment === live.payment &&
    changeRate === live.annualRatePct &&
    changeFrequency === live.frequency;
  const extraPreview = useMemo(() => {
    const amount = roundCents(Number(extraAmount.replace(/[^0-9.]/g, "")));
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return draftExtraPayment(ledger, {
      date: extraDate || today,
      amount,
      note: extraNote,
    });
  }, [ledger, extraDate, extraAmount, extraNote, today]);
  const extraPreviewResult = useMemo(
    () => (extraPreview ? simulateNote(extraPreview) : null),
    [extraPreview],
  );
  const extraImpact = extraPreviewResult ? compareResults(result, extraPreviewResult) : null;
  const previewImpact = termsUnchanged ? null : compareResults(result, previewResult);

  function recordExtra() {
    const amount = roundCents(Number(extraAmount.replace(/[^0-9.]/g, "")));
    if (!Number.isFinite(amount) || amount <= 0) return;
    const date = extraDate || today;
    onChange(
      addExtraPayment(ledger, {
        date,
        amount,
        note: extraNote,
      }),
    );
    setExtraAmount("");
    setExtraNote("");
    setExportedHtml(null);
    setExportNotice(null);
    setMailFile(null);
  }

  function applyTerms() {
    if (previewResult.neverPaysOff) return;
    onChange(
      addTermChange(ledger, {
        date: changeDate || today,
        payment: changePayment,
        annualRatePct: changeRate,
        frequency: changeFrequency,
        note: changeNote,
      }),
    );
    setChangeNote("");
    setExportedHtml(null);
    setExportNotice(null);
    setMailFile(null);
  }

  const version = termsVersion(ledger);
  const needsResign = exportNeedsLenderResign(ledger.signatures, version, ledger.termChanges.length);
  const signaturesCurrent = signaturesMatchVersion(ledger.signatures, version);

  function publishExport(html: string, filename: string, notice: string, mailed: boolean) {
    downloadStruckHtml(html, filename);
    setExportedHtml(html);
    setExportNotice(notice);
    setMailFile(mailed ? { title: ledger.title, filename } : null);
  }

  function exportUpdated() {
    if (result.neverPaysOff) return;
    if (needsResign) {
      setSignOpen(true);
      return;
    }
    const payload = buildStruckPayloadFromLedger(ledger, result);
    const html = buildStruckHtml(payload);
    const filename = struckFilename(ledger.title);
    publishExport(
      html,
      filename,
      payload.signatures.lender
        ? `Downloaded ${filename}. Signatures on this version stay as they are. Extra payments do not need another signature.`
        : `Downloaded ${filename}.`,
      false,
    );
  }

  function approveResign(name: string) {
    const signatures = signAsLender(version, name);
    const next = { ...ledger, signatures };
    onChange(next);
    const payload = buildStruckPayloadFromLedger(next, result);
    const html = buildStruckHtml(payload);
    const filename = struckFilename(next.title);
    const clearedBorrower = Boolean(ledger.signatures?.borrower);
    publishExport(
      html,
      filename,
      clearedBorrower
        ? `Downloaded ${filename}. Your email app should be open — attach that file and send it to the borrower. Their earlier signature is not on this copy.`
        : `Downloaded ${filename}. Your email app should be open — attach that file and send it to the borrower. The To line is blank so you can type their address.`,
      true,
    );
    openMailHandoff("lender", next.title, filename);
    setSignOpen(false);
  }

  const amendments = amendmentCount(ledger);
  const freq = FREQUENCIES.find((item) => item.id === live.frequency);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Active note
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-tight text-foreground italic md:text-5xl">
            {ledger.title}
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            {[ledger.lender ? `Lent by ${ledger.lender}` : "", ledger.borrower ? `Borrowed by ${ledger.borrower}` : ""]
              .filter(Boolean)
              .join(" · ") || "Scheduled deposits are assumed on time."}{" "}
            History through each extra payment or term change stays put. Everything after is
            recalculated.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose}>
            <RotateCcw />
            Back to calculator
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-3">
        <aside className="min-w-0 rounded-3xl bg-card p-5 shadow-ledger lg:sticky lg:top-6">
          <AsOfStatus result={result} rate={live.annualRatePct} />

          <dl className="mt-4 grid gap-2 text-sm">
            <InfoRow label="Original amount" value={formatMoney(ledger.principal)} />
            <InfoRow
              label="Current terms"
              value={`${formatMoney(live.payment)} ${freq?.label.toLowerCase() ?? ""} at ${formatPct(live.annualRatePct)}`}
            />
            <InfoRow label="Started" value={format(parseISODate(ledger.startDate), "MMM d, yyyy")} />
            <InfoRow
              label="Payoff"
              value={result.payoffDate ? format(result.payoffDate, "MMM d, yyyy") : "—"}
            />
          </dl>

          <section className="mt-6">
            <h2 className="font-medium">Extra payment</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              One-time money on top of the regular deposit. History before this date is frozen.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <Label htmlFor="extra-date" className="normal-case tracking-normal">
                  Date
                </Label>
                <Input
                  id="extra-date"
                  type="date"
                  className="mt-1.5"
                  min={ledger.startDate}
                  value={extraDate}
                  onChange={(e) => setExtraDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="extra-amount" className="normal-case tracking-normal">
                  Amount
                </Label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="extra-amount"
                    className="pl-7"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={extraAmount}
                    onChange={(e) => setExtraAmount(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="extra-note" className="normal-case tracking-normal">
                  Note
                </Label>
                <Input
                  id="extra-note"
                  className="mt-1.5"
                  placeholder="Bonus, tax refund…"
                  value={extraNote}
                  onChange={(e) => setExtraNote(e.target.value)}
                />
              </div>
              {extraImpact ? <ImpactCard impact={extraImpact} /> : null}
              <Button
                id="record-extra"
                className="w-full"
                type="button"
                onClick={recordExtra}
              >
                Record extra payment
              </Button>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="font-medium">Change terms</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              New rate, payment, or frequency from a date forward. Direct deposits after that follow
              the new cadence.
            </p>
            <div className="mt-3 space-y-4">
              <div>
                <Label htmlFor="change-date" className="normal-case tracking-normal">
                  Effective date
                </Label>
                <Input
                  id="change-date"
                  type="date"
                  className="mt-1.5"
                  min={ledger.startDate}
                  value={changeDate}
                  onChange={(e) => setChangeDate(e.target.value)}
                />
              </div>
              <div>
                <SliderField
                  id="change-payment"
                  label="Payment"
                  prefix="$"
                  text={changePaymentText}
                  onText={setChangePaymentText}
                  onCommit={(n) => {
                    const next = clamp(n, 1, 1_000_000);
                    setChangePayment(next);
                    setChangePaymentText(String(next));
                  }}
                  value={changePayment}
                  min={1}
                  max={paymentSliderMax}
                  step={5}
                  display={formatMoney(changePayment)}
                />
              </div>
              <div>
                <SliderField
                  id="change-rate"
                  label="Rate"
                  suffix="%"
                  text={changeRateText}
                  onText={setChangeRateText}
                  onCommit={(n) => {
                    const next = clamp(Math.round(n * 100) / 100, 0, 49);
                    setChangeRate(next);
                    setChangeRateText(String(next));
                  }}
                  value={changeRate}
                  min={0}
                  max={25}
                  step={0.05}
                  display={formatPct(changeRate)}
                />
              </div>
              <div>
                <Label>How often</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {FREQUENCIES.map((item) => {
                    const active = changeFrequency === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setChangeFrequency(item.id)}
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
              </div>
              <Input
                placeholder="Why the terms changed"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
              />
              {previewResult.neverPaysOff ? (
                <p className="text-xs leading-relaxed text-destructive">
                  Those terms never pay it off. Raise the payment or pay more often.
                </p>
              ) : previewImpact ? (
                <ImpactCard impact={previewImpact} />
              ) : null}
              <Button
                id="apply-terms"
                className="w-full"
                type="button"
                onClick={applyTerms}
                disabled={previewResult.neverPaysOff || termsUnchanged}
              >
                Apply new terms
              </Button>
            </div>
          </section>

          {amendments > 0 ? (
            <Button
              id="undo-amendment"
              variant="ghost"
              className="mt-4 w-full"
              type="button"
              onClick={() => {
                onChange(undoLastAmendment(ledger));
                setExportedHtml(null);
                setExportNotice(null);
                setMailFile(null);
              }}
            >
              <Undo2 />
              Undo last change
            </Button>
          ) : null}

          <Button
            id="export-ledger"
            className="mt-6 w-full"
            type="button"
            onClick={exportUpdated}
            disabled={result.neverPaysOff}
          >
            <Download />
            {needsResign ? "E-sign and export HTML" : "Export updated HTML"}
          </Button>
          {exportNotice ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{exportNotice}</p>
          ) : needsResign ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Payment, rate, or frequency changed. Exporting asks you to e-sign again and leaves
              the borrower signature off so you can send a fresh copy.
            </p>
          ) : signaturesCurrent ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {ledger.signatures?.borrower
                ? "Both signatures are on this version. An extra payment does not ask anyone to sign again."
                : "Your signature is on this version. An extra payment does not ask you to sign again."}
            </p>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Downloads a new file with the payment log baked in. Open it later and remaining
              balance still follows the calendar.
            </p>
          )}
          {mailFile ? (
            <Button
              variant="outline"
              className="mt-3 w-full"
              type="button"
              onClick={() => openMailHandoff("lender", mailFile.title, mailFile.filename)}
            >
              <Mail />
              Open email
            </Button>
          ) : null}
          {exportedHtml ? (
            <iframe
              title="Updated ledger preview"
              className="mt-4 h-64 w-full rounded-xl bg-background"
              srcDoc={exportedHtml}
            />
          ) : null}
          <Dialog open={signOpen} onOpenChange={setSignOpen}>
            <DialogContent>
              <ESignApprove
                partyName={ledger.lender}
                description="Payment, rate, or frequency changed, so this note needs your signature again. The borrower e-signs the new file after you send it."
                recap={
                  <p className="mt-4 rounded-md bg-muted px-4 py-3 text-sm">
                    {formatMoney(live.payment)} {freq?.label.toLowerCase() ?? ""} at{" "}
                    {formatPct(live.annualRatePct)}
                    <span className="mt-1 block text-muted-foreground">
                      {ledger.title}
                      {ledger.lender ? ` · Lent by ${ledger.lender}` : ""}
                      {ledger.borrower ? ` · Borrowed by ${ledger.borrower}` : ""}
                    </span>
                  </p>
                }
                onApprove={approveResign}
                onBack={() => setSignOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </aside>

        <section className="min-w-0 space-y-6 lg:col-span-2">
          {result.neverPaysOff ? (
            <div className="flex gap-3 rounded-3xl bg-card p-5 shadow-ledger">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <h2 className="font-medium">These terms no longer pay it off</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Undo the last change or raise the payment so the balance can fall.
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
                <Stat label="Scheduled payments" value={formatCount(result.paymentCount)} />
                <Stat
                  label="Paid so far"
                  value={formatMoney(selected.cumulativeInterest + (ledger.principal - selected.balance))}
                />
              </div>
              <div className="rounded-3xl bg-card p-5 shadow-ledger">
                <h2 className="font-display text-xl font-medium tracking-tight">Payoff</h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Extra payments show as labeled flags. Dashed lines are earlier term sets — what
                  payoff would have been if those terms had continued.
                </p>
                {overlays.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {overlays.map((overlay, i) => (
                      <li key={overlay.id} className="flex items-center gap-2">
                        <span
                          className="inline-block w-4 border-b border-muted-foreground"
                          style={{ borderBottomStyle: i === 0 ? "dashed" : "dotted" }}
                        />
                        {overlay.label}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-4">
                  <PayoffChart
                    points={result.points}
                    selectedIndex={selected.index}
                    onSelect={setSelectedIndex}
                    overlays={overlays}
                  />
                </div>
              </div>
              <div className="rounded-3xl bg-card p-5 shadow-ledger">
                <h2 className="font-display text-xl font-medium tracking-tight">
                  Principal and interest
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Paid versus remaining, split into principal and interest.
                </p>
                <div className="mt-4">
                  <LoanMix
                    principal={ledger.principal}
                    point={selected}
                    totalInterest={result.totalInterest}
                  />
                </div>
              </div>
              <div className="rounded-3xl bg-card p-5 shadow-ledger">
                <h2 className="font-display text-xl font-medium tracking-tight">Payment log</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Changes up top. Pick a year to see that year's deposits.
                </p>
                <div className="mt-4">
                  <PaymentSchedule
                    points={result.points}
                    selectedIndex={selected.index}
                    onSelect={setSelectedIndex}
                    asOf={asOf ?? undefined}
                  />
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function roundCents(n: number) {
  return Math.round(n * 100) / 100;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-card px-5 py-4 shadow-ledger">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl font-medium tracking-tight tabular-nums">{value}</p>
    </div>
  );
}
