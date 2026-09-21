import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Check, Copy, Download, Lock, Mail } from "lucide-react";
import { ESignApprove } from "@/components/esign-approve";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openMailHandoff, signAsLender, termsVersion } from "@/lib/esign";
import { formatMoney, formatPct } from "@/lib/format";
import { frequencyMeta, parseISODate, type Frequency, type LoanResult } from "@/lib/loan";
import {
  buildStruckHtml,
  buildStruckPayload,
  downloadStruckHtml,
  struckFilename,
  type StruckPayload,
} from "@/lib/struck-html";

const LAST_KEY = "paydown:last-struck:v1";

type SavedStruck = {
  title: string;
  filename: string;
  html: string;
};

function readLast(): SavedStruck | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedStruck;
    if (!parsed.html || !parsed.filename) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function StrikeLoan({
  principal,
  rate,
  payment,
  frequency,
  startDate,
  result,
}: {
  principal: number;
  rate: number;
  payment: number;
  frequency: Frequency;
  startDate: string;
  result: LoanResult;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [lender, setLender] = useState("");
  const [borrower, setBorrower] = useState("");
  const [html, setHtml] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [copied, setCopied] = useState(false);
  const [last, setLast] = useState<SavedStruck | null>(null);
  const [step, setStep] = useState<"details" | "sign" | "done">("details");
  const [sentTitle, setSentTitle] = useState("");
  const [justSigned, setJustSigned] = useState(false);

  useEffect(() => {
    setLast(readLast());
  }, []);

  const locked = !result.neverPaysOff;
  const freq = frequencyMeta(frequency);
  const payoff = result.payoffDate ? format(result.payoffDate, "MMM d, yyyy") : "—";

  function persist(next: SavedStruck) {
    window.localStorage.setItem(LAST_KEY, JSON.stringify(next));
    setLast(next);
  }

  function approveAndStrike(signingName: string) {
    const unsigned = buildStruckPayload(
      {
        principal,
        annualRatePct: rate,
        payment,
        frequency,
        startDate,
      },
      result,
      { title, lender: lender.trim(), borrower: borrower.trim() },
    );
    const payload: StruckPayload = {
      ...unsigned,
      signatures: signAsLender(
        termsVersion({
          payment: unsigned.payment,
          annualRatePct: unsigned.annualRatePct,
          frequency: unsigned.frequency,
          termChanges: unsigned.termChanges,
        }),
        signingName,
      ),
    };
    const nextHtml = buildStruckHtml(payload);
    const nextName = struckFilename(payload.title);
    downloadStruckHtml(nextHtml, nextName);
    openMailHandoff("lender", payload.title, nextName);
    persist({ title: payload.title, filename: nextName, html: nextHtml });
    setHtml(nextHtml);
    setFilename(nextName);
    setSentTitle(payload.title);
    setCopied(false);
    setJustSigned(true);
    setStep("done");
  }

  function copyHtml() {
    if (!html) return;
    void navigator.clipboard.writeText(html).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  function reopenLast() {
    if (!last) return;
    setHtml(last.html);
    setFilename(last.filename);
    setSentTitle(last.title);
    setCopied(false);
    setJustSigned(false);
    setStep("done");
    setOpen(true);
  }

  function openMailAgain() {
    if (!filename) return;
    openMailHandoff("lender", sentTitle || "Personal note", filename);
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setHtml(null);
            setCopied(false);
            setStep("details");
            setJustSigned(false);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button id="strike-loan" className="w-full" disabled={!locked} type="button">
            <Lock />
            Strike this loan
          </Button>
        </DialogTrigger>
        <DialogContent className={step === "done" ? "max-w-3xl" : undefined}>
          {step === "done" ? (
            <>
              <DialogTitle>Note struck</DialogTitle>
              <DialogDescription>
                {justSigned
                  ? `Your e-signature is in ${filename}. It should be in your downloads, and your email app should be open. Attach that HTML file and send it to the borrower. The To line is blank so you can type their address. They e-sign inside the file and send it back.`
                  : `${filename} is the last note you struck. Download it again, or open email if you still need to send it to the borrower.`}
              </DialogDescription>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                  className="flex-1"
                  type="button"
                  onClick={() => html && downloadStruckHtml(html, filename)}
                >
                  <Download />
                  Download again
                </Button>
                <Button variant="outline" className="flex-1" type="button" onClick={openMailAgain}>
                  <Mail />
                  Open email
                </Button>
                <Button variant="outline" className="flex-1" type="button" onClick={copyHtml}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Copied HTML" : "Copy HTML"}
                </Button>
              </div>
              <iframe
                title="Struck ledger preview"
                className="mt-4 h-80 w-full rounded-xl bg-background sm:h-96"
                srcDoc={html ?? undefined}
              />
            </>
          ) : step === "sign" ? (
            <ESignApprove
              partyName={lender.trim()}
              confirmId="download-ledger"
              description="You are e-signing as the lender. The signed file downloads next, then your email app opens so you can attach it and send it to the borrower."
              recap={
                <p className="mt-4 rounded-md bg-muted px-4 py-3 text-sm">
                  {formatMoney(principal)} at {formatPct(rate)} · {formatMoney(payment)}{" "}
                  {freq.label.toLowerCase()}
                  <span className="mt-1 block text-muted-foreground">
                    Lent by {lender.trim()} · Borrowed by {borrower.trim()}
                  </span>
                </p>
              }
              onApprove={approveAndStrike}
              onBack={() => setStep("details")}
            />
          ) : (
            <>
              <DialogTitle>Strike the note</DialogTitle>
              <DialogDescription>
                Locks these terms into a single HTML file with a printable agreement. Keep that
                file with the real loan. Whenever you open it, remaining balance follows the date
                on the clock.
              </DialogDescription>

              <dl className="mt-4 grid gap-2 rounded-md bg-muted px-4 py-3 text-sm">
                <Row label="Amount" value={formatMoney(principal)} />
                <Row label="Rate" value={formatPct(rate)} />
                <Row
                  label="Payment"
                  value={`${formatMoney(payment)} ${freq.label.toLowerCase()}`}
                />
                <Row label="Starts" value={format(parseISODate(startDate), "MMM d, yyyy")} />
                <Row label="Last payment" value={payoff} />
                <Row label="Interest" value={formatMoney(result.totalInterest)} />
              </dl>

              <div className="mt-4 space-y-3">
                <div>
                  <Label htmlFor="note-title" className="normal-case tracking-normal">
                    Name this note
                  </Label>
                  <Input
                    id="note-title"
                    className="mt-1.5"
                    placeholder="Cabin repair, truck, etc."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="note-lender" className="normal-case tracking-normal">
                      Lent by
                    </Label>
                    <Input
                      id="note-lender"
                      className="mt-1.5"
                      placeholder="Name on the agreement"
                      maxLength={160}
                      value={lender}
                      onChange={(e) => setLender(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="note-borrower" className="normal-case tracking-normal">
                      Borrowed by
                    </Label>
                    <Input
                      id="note-borrower"
                      className="mt-1.5"
                      placeholder="Name on the agreement"
                      maxLength={160}
                      value={borrower}
                      onChange={(e) => setBorrower(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Names go on the promissory note inside the file. Next you e-sign as the lender.
                Regular deposits are assumed on time. Extra payments stay on this signature. A
                change to the payment, rate, or frequency needs you to e-sign again.
              </p>

              <Button
                id="continue-esign"
                className="mt-5 w-full"
                type="button"
                disabled={!lender.trim() || !borrower.trim()}
                onClick={() => setStep("sign")}
              >
                Continue to e-sign
              </Button>
              {!lender.trim() || !borrower.trim() ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Add both names so they appear on the note and the signature.
                </p>
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>
      {last ? (
        <button
          type="button"
          onClick={reopenLast}
          className="mt-2 w-full text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Reopen last struck note ({last.title})
        </button>
      ) : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
