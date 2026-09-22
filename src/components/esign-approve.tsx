import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SCRIPT_FONT =
  '"Segoe Script", "Snell Roundhand", "Apple Chancery", "Brush Script MT", "Segoe Print", cursive';

export function ESignApprove({
  partyName,
  description,
  recap,
  confirmId = "approve-esign",
  onApprove,
  onBack,
}: {
  partyName: string;
  description: string;
  recap?: ReactNode;
  confirmId?: string;
  onApprove: (name: string) => void;
  onBack?: () => void;
}) {
  const [name, setName] = useState(partyName);
  const [pending, setPending] = useState(false);
  const trimmed = name.trim();

  function approve() {
    if (!trimmed || pending) return;
    setPending(true);
    onApprove(trimmed);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        approve();
      }}
    >
      <DialogTitle>E-sign the note</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
      {recap}
      <div className="mt-4">
        <Label htmlFor="esign-name" className="normal-case tracking-normal">
          Signing name
        </Label>
        <Input
          id="esign-name"
          className="mt-1.5"
          value={name}
          maxLength={160}
          autoComplete="name"
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />
        <p
          className="mt-3 min-h-10 text-3xl leading-tight text-foreground"
          style={{ fontFamily: SCRIPT_FONT }}
          aria-hidden
        >
          {trimmed || "Your name"}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          This typed name is your electronic signature. It is written only into the HTML file.
        </p>
      </div>
      <Button id={confirmId} className="mt-5 w-full" type="submit" disabled={!trimmed || pending}>
        Yes, I approve e-signing this doc
      </Button>
      {onBack ? (
        <Button variant="ghost" className="mt-2 w-full" type="button" onClick={onBack} disabled={pending}>
          Back
        </Button>
      ) : null}
    </form>
  );
}
