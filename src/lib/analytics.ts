import { roundCents, type PaymentPoint } from "./loan.ts";

export type LoanMix = {
  principal: number;
  principalPaid: number;
  interestPaid: number;
  principalLeft: number;
  interestLeft: number;
  paid: number;
  remaining: number;
  total: number;
};

export function mixAtPoint(
  principal: number,
  point: PaymentPoint,
  totalInterest: number,
): LoanMix {
  const principalLeft = Math.max(0, point.balance);
  const principalPaid = roundCents(Math.max(0, principal - principalLeft));
  const interestPaid = Math.max(0, point.cumulativeInterest);
  const interestLeft = Math.max(0, point.remainingInterest || roundCents(totalInterest - interestPaid));
  const paid = roundCents(principalPaid + interestPaid);
  const remaining = roundCents(principalLeft + interestLeft);
  return {
    principal,
    principalPaid,
    interestPaid,
    principalLeft,
    interestLeft,
    paid,
    remaining,
    total: roundCents(principal + totalInterest),
  };
}

export function share(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}
