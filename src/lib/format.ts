const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const moneyWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return money.format(n);
}

export function formatMoneyWhole(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return moneyWhole.format(n);
}

export function formatMoneyCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.abs(n) >= 10000 ? compactMoney.format(n) : money.format(n);
}

export function formatPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const digits = n < 10 ? 2 : 1;
  return `${n.toFixed(digits)}%`;
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatAxisMoney(n: number): string {
  if (!Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  if (abs >= 1000) {
    const k = n / 1000;
    const digits = abs >= 10000 ? 0 : 1;
    return `$${k.toFixed(digits)}k`;
  }
  return `$${Math.round(n)}`;
}
