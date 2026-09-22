export type PartySignature = {
  name: string;
  signedAt: string;
};

/** Signatures apply to one set of payment / rate / frequency terms. Extra payments do not change that set. */
export type NoteSignatures = {
  termsVersion: string;
  lender: PartySignature | null;
  borrower: PartySignature | null;
};

export type TermsVersionInput = {
  payment: number;
  annualRatePct: number;
  frequency: string;
  termChanges?: Array<{
    id?: string;
    date: string;
    payment: number;
    annualRatePct: number;
    frequency: string;
  }> | null;
};

const LENDER_SUBJECT = "Promissory note to sign: {{title}}";
const BORROWER_SUBJECT = "Signed promissory note: {{title}}";

const LENDER_BODY = [
  'I e-signed the promissory note "{{title}}".',
  "",
  "The signed HTML file was just downloaded to this device ({{filename}}).",
  "Attach that file to this email and send it to the borrower.",
  "",
  "They open the file, review the note, e-sign once, and email the dual-signed file back.",
  "",
  "— No Toil Loans",
].join("\n");

const BORROWER_BODY = [
  'I reviewed and e-signed the promissory note "{{title}}".',
  "",
  "The dual-signed HTML file was just downloaded to this device ({{filename}}).",
  "Attach that file to this email and send it back to the lender.",
  "",
  "— No Toil Loans",
].join("\n");

export function termsVersion(input: TermsVersionInput): string {
  const changes = [...(input.termChanges ?? [])]
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return (a.id ?? "").localeCompare(b.id ?? "");
    })
    .map((change) =>
      [change.id ?? "", change.date, change.payment, change.annualRatePct, change.frequency].join("|"),
    );
  return ["v1", input.payment, input.annualRatePct, input.frequency, ...changes].join("~");
}

export function emptySignatures(version: string): NoteSignatures {
  return { termsVersion: version, lender: null, borrower: null };
}

export function parsePartySignature(value: unknown): PartySignature | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { name?: unknown; signedAt?: unknown };
  if (typeof record.name !== "string" || typeof record.signedAt !== "string") return null;
  const name = record.name.trim();
  const signedAt = record.signedAt.trim();
  if (!name || name.length > 160 || !signedAt) return null;
  if (Number.isNaN(new Date(signedAt).getTime())) return null;
  return { name, signedAt };
}

export function parseNoteSignatures(value: unknown, version: string): NoteSignatures {
  if (!value || typeof value !== "object") return emptySignatures(version);
  const record = value as { termsVersion?: unknown; lender?: unknown; borrower?: unknown };
  const storedVersion = typeof record.termsVersion === "string" ? record.termsVersion : "";
  const lender = parsePartySignature(record.lender);
  const borrower = lender ? parsePartySignature(record.borrower) : null;
  if (!storedVersion) return emptySignatures(version);
  return {
    termsVersion: storedVersion,
    lender,
    borrower,
  };
}

export function signaturesMatchVersion(
  signatures: NoteSignatures | null | undefined,
  version: string,
): boolean {
  return Boolean(signatures && signatures.termsVersion === version && signatures.lender);
}

/** Term changes need a fresh lender signature. Extra payments keep the signatures already on the note. */
export function exportNeedsLenderResign(
  signatures: NoteSignatures | null | undefined,
  version: string,
  termChangeCount: number,
): boolean {
  if (signaturesMatchVersion(signatures, version)) return false;
  return termChangeCount > 0;
}

export function signaturesForDocument(
  signatures: NoteSignatures | null | undefined,
  version: string,
): NoteSignatures {
  if (signatures && signatures.termsVersion === version) {
    return {
      termsVersion: version,
      lender: signatures.lender,
      borrower: signatures.lender ? signatures.borrower : null,
    };
  }
  return emptySignatures(version);
}

export function signAsLender(version: string, name: string, signedAt = new Date()): NoteSignatures {
  return {
    termsVersion: version,
    lender: { name: name.trim(), signedAt: signedAt.toISOString() },
    borrower: null,
  };
}

function fillTemplate(template: string, title: string, filename: string): string {
  return template.split("{{title}}").join(title).split("{{filename}}").join(filename);
}

export function handoffMessage(
  role: "lender" | "borrower",
  title: string,
  filename: string,
): { subject: string; body: string } {
  const subject = role === "lender" ? LENDER_SUBJECT : BORROWER_SUBJECT;
  const body = role === "lender" ? LENDER_BODY : BORROWER_BODY;
  return {
    subject: fillTemplate(subject, title, filename),
    body: fillTemplate(body, title, filename),
  };
}

export function mailtoHref(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function openMailHandoff(role: "lender" | "borrower", title: string, filename: string) {
  const message = handoffMessage(role, title, filename);
  const link = document.createElement("a");
  link.href = mailtoHref(message.subject, message.body);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Borrower mail copy, injected into the struck HTML so the file stays self-contained. */
export function borrowerHandoffTemplates(): { subject: string; body: string } {
  return { subject: BORROWER_SUBJECT, body: BORROWER_BODY };
}
