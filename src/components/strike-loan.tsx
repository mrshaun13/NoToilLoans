import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Check, Copy, Download, Lock } from "lucide-react";
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

  useEffect(() => {
    setLast(readLast());
  }, []);

  const locked = !result.neverPaysOff;
  const freq = frequencyMeta(frequency);
  const payoff = result.payoffDate ? format(result.payoffDate, "MMM d, yyyy") : "—";
  const struck = Boolean(html);

  function persist(next: SavedStruck) {
    window.localStorage.setItem(LAST_KEY, JSON.stringify(next));
    setLast(next);
  }

  function strikeFrom(payload: StruckPayload) {
    const nextHtml = buildStruckHtml(payload);
    const nextName = struckFilename(payload.title);
    downloadStruckHtml(nextHtml, nextName);
    persist({ title: payload.title, filename: nextName, html: nextHtml });
    setHtml(nextHtml);
    setFilename(nextName);
    setCopied(false);
  }

  function strike() {
    const payload = buildStruckPayload(
      {
        principal,
        annualRatePct: rate,
        payment,
        frequency,
        startDate,
      },
      result,
      { title, lender, borrower },
    );
    strikeFrom(payload);
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
    setCopied(false);
    setOpen(true);
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
          }
        }}
      >
        <DialogTrigger asChild>
          <Button id="strike-loan" className="w-full" disabled={!locked} type="button">
            <Lock />
            Strike this loan
          </Button>
        </DialogTrigger>
        <DialogContent className={struck ? "max-w-3xl" : undefined}>
          {struck ? (
            <>
              <DialogTitle>Note struck</DialogTitle>
              <DialogDescription>
                Terms are locked in {filename}. The file includes a printable promissory note for
                both of you to sign. Open it any day — it reads today's date and shows what is
                still owed.
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
                      value={borrower}
                      onChange={(e) => setBorrower(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Names go on a printable promissory note inside the file — interest method, extra
                payments of any size, and how payoff is recalculated. Regular deposits are assumed
                on time. If extra is paid or the terms change, open this file here, log it, and
                export again.
              </p>

              <Button id="download-ledger" className="mt-5 w-full" type="button" onClick={strike}>
                <Download />
                Strike and download HTML
              </Button>
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
