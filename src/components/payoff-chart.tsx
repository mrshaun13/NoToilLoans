import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import type { TermPath } from "@/lib/ledger";
import { describeImpact } from "@/lib/impact";
import { downsamplePoints, type PaymentPoint } from "@/lib/loan";
import { formatAxisMoney, formatMoney } from "@/lib/format";

const ALT_KEYS = ["alt0", "alt1", "alt2", "alt3"] as const;
const ALT_DASH = ["6 5", "3 4", "8 3 2 3", "2 3"];

type ChartDatum = {
  index: number;
  t: number;
  dateLabel: string;
  tickLabel: string;
  balance: number;
  remainingInterest: number;
  extraBalance: number | null;
  extraAmount: number;
  termsBalance: number | null;
  kind: PaymentPoint["kind"];
  note: string;
  payment: number;
  impactLine: string;
  alt0: number | null;
  alt1: number | null;
  alt2: number | null;
  alt3: number | null;
};

function ChartTip({
  active,
  payload,
  overlays,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartDatum }>;
  overlays: TermPath[];
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const row = payload[0].payload;
  const label =
    row.kind === "extra"
      ? `Extra ${formatMoney(row.payment)}`
      : row.kind === "terms"
        ? row.note || "Terms changed"
        : row.index === 0
          ? "Start"
          : `Payment ${row.index}`;
  return (
    <div className="rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground shadow-ledger">
      <p className="font-medium">
        {label}
        <span className="text-primary-foreground/70"> · {row.dateLabel}</span>
      </p>
      <p className="mt-1 tabular-nums">Balance {formatMoney(row.balance)}</p>
      {row.impactLine ? (
        <p className="mt-1 text-primary-foreground/85">{row.impactLine}</p>
      ) : null}
      {overlays.map((overlay, i) => {
        const value = row[ALT_KEYS[i] ?? "alt0"];
        if (value == null) return null;
        return (
          <p key={overlay.id} className="tabular-nums text-primary-foreground/80">
            {overlay.label} · {formatMoney(value)}
          </p>
        );
      })}
    </div>
  );
}

function ExtraMark({
  cx,
  cy,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: ChartDatum;
}) {
  if (cx == null || cy == null || !payload || payload.kind !== "extra") return null;
  const label = formatMoney(payload.extraAmount || payload.payment);
  const width = Math.max(58, label.length * 7.2 + 16);
  const flagY = 8;
  const flagX = cx + 10;
  return (
    <g>
      <line
        x1={cx}
        y1={flagY + 18}
        x2={cx}
        y2={cy}
        stroke="var(--color-ok)"
        strokeWidth={2}
      />
      <circle
        cx={cx}
        cy={cy}
        r={7}
        fill="var(--color-ok)"
        stroke="var(--color-card)"
        strokeWidth={3}
      />
      <circle cx={cx} cy={cy} r={2.5} fill="var(--color-card)" />
      <rect x={flagX} y={flagY} width={width} height={22} rx={6} fill="var(--color-ok)" />
      <polygon
        points={`${flagX},${flagY + 6} ${flagX - 7},${flagY + 11} ${flagX},${flagY + 16}`}
        fill="var(--color-ok)"
      />
      <text
        x={flagX + width / 2}
        y={flagY + 15}
        textAnchor="middle"
        fill="var(--color-card)"
        fontSize={11}
        fontWeight={700}
      >
        {label}
      </text>
    </g>
  );
}

function balanceOn(points: PaymentPoint[], date: Date): number {
  const t = date.getTime();
  let last = points[0]?.balance ?? 0;
  for (const point of points) {
    if (point.date.getTime() <= t) last = point.balance;
    else break;
  }
  return last;
}

export function PayoffChart({
  points,
  selectedIndex,
  onSelect,
  overlays = [],
}: {
  points: PaymentPoint[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  overlays?: TermPath[];
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);

  const limited = overlays.slice(0, ALT_KEYS.length);

  const data = useMemo<ChartDatum[]>(() => {
    const sampled = downsamplePoints(points);
    const liveEnd = points[points.length - 1]?.date.getTime() ?? 0;
    const live = sampled.map((p) => {
      const alts = limited.map((overlay) => balanceOn(overlay.points, p.date));
      return {
        index: p.index,
        t: p.date.getTime(),
        dateLabel: format(p.date, "MMM d, yyyy"),
        tickLabel: format(p.date, "MMM yy"),
        balance: p.balance,
        remainingInterest: p.remainingInterest,
        extraBalance: p.kind === "extra" ? p.balance + p.remainingInterest : null,
        extraAmount: p.kind === "extra" ? p.payment : 0,
        termsBalance: p.kind === "terms" ? p.balance + p.remainingInterest : null,
        kind: p.kind,
        note: p.note,
        payment: p.payment,
        impactLine: p.impact ? describeImpact(p.impact).headline : "",
        alt0: alts[0] ?? null,
        alt1: alts[1] ?? null,
        alt2: alts[2] ?? null,
        alt3: alts[3] ?? null,
      };
    });
    const tails: ChartDatum[] = [];
    limited.forEach((overlay, i) => {
      overlay.points
        .filter((point) => point.date.getTime() > liveEnd + 12 * 60 * 60 * 1000)
        .forEach((p) => {
          const alts: [number | null, number | null, number | null, number | null] = [
            null,
            null,
            null,
            null,
          ];
          alts[i] = p.balance;
          tails.push({
            index: -1,
            t: p.date.getTime(),
            dateLabel: format(p.date, "MMM d, yyyy"),
            tickLabel: format(p.date, "MMM yy"),
            balance: 0,
            remainingInterest: 0,
            extraBalance: null,
            extraAmount: 0,
            termsBalance: null,
            kind: "scheduled",
            note: "",
            payment: p.payment,
            impactLine: "",
            alt0: alts[0],
            alt1: alts[1],
            alt2: alts[2],
            alt3: alts[3],
          });
        });
    });
    const merged = [...live, ...tails].sort((a, b) => a.t - b.t);
    const byT = new Map<number, ChartDatum>();
    for (const row of merged) {
      const existing = byT.get(row.t);
      if (!existing) {
        byT.set(row.t, row);
        continue;
      }
      byT.set(row.t, {
        ...existing,
        extraBalance: existing.extraBalance ?? row.extraBalance,
        extraAmount: existing.extraAmount || row.extraAmount,
        kind: existing.kind === "extra" ? existing.kind : row.kind,
        alt0: existing.alt0 ?? row.alt0,
        alt1: existing.alt1 ?? row.alt1,
        alt2: existing.alt2 ?? row.alt2,
        alt3: existing.alt3 ?? row.alt3,
      });
    }
    return [...byT.values()].sort((a, b) => a.t - b.t);
  }, [points, limited]);

  const extras = useMemo(() => data.filter((row) => row.kind === "extra"), [data]);
  const selected = points.find((point) => point.index === selectedIndex);
  const selectedT = selected?.date.getTime();
  const tMin = data[0]?.t ?? 0;
  const tMax = data[data.length - 1]?.t ?? 1;

  if (!ready) {
    return <div className="h-64 w-full rounded-md bg-muted md:h-80" />;
  }

  return (
    <div className="h-64 w-full overflow-hidden md:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 34, right: 72, left: 0, bottom: 0 }}
          onClick={(state) => {
            const idx = state?.activePayload?.[0]?.payload?.index;
            if (typeof idx === "number" && idx >= 0) onSelect(idx);
          }}
        >
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-principal)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-principal)" stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id="interestFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-interest)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--color-interest)" stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 6" />
          <XAxis
            dataKey="t"
            type="number"
            domain={[tMin, tMax]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            tickFormatter={(value: number) => format(new Date(value), "MMM yy")}
            minTickGap={28}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            tickFormatter={(v: number) => formatAxisMoney(v)}
          />
          <RechartsTooltip
            content={(props) => (
              <ChartTip
                active={props.active}
                payload={props.payload as Array<{ payload?: ChartDatum }> | undefined}
                overlays={limited}
              />
            )}
            cursor={{ stroke: "var(--color-foreground)", strokeOpacity: 0.2 }}
          />
          <Area
            stackId="payoff"
            type="stepAfter"
            dataKey="balance"
            name="Remaining balance"
            stroke="var(--color-principal)"
            fill="url(#balanceFill)"
            strokeWidth={2.25}
            isAnimationActive={false}
          />
          <Area
            stackId="payoff"
            type="stepAfter"
            dataKey="remainingInterest"
            name="Remaining interest"
            stroke="var(--color-interest)"
            fill="url(#interestFill)"
            strokeWidth={1.5}
            isAnimationActive={false}
          />
          {limited.map((overlay, i) => (
            <Line
              key={overlay.id}
              type="stepAfter"
              dataKey={ALT_KEYS[i]}
              name={overlay.label}
              stroke="var(--color-muted-foreground)"
              strokeDasharray={ALT_DASH[i]}
              strokeWidth={1.8}
              strokeOpacity={0.95 - i * 0.15}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
          {selectedT != null ? (
            <ReferenceLine
              x={selectedT}
              stroke="var(--color-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.45}
            />
          ) : null}
          {extras.map((row) => (
            <ReferenceLine
              key={`extra-${row.t}`}
              x={row.t}
              stroke="var(--color-ok)"
              strokeDasharray="2 4"
              strokeOpacity={0.45}
            />
          ))}
          <Scatter
            data={extras}
            dataKey="extraBalance"
            fill="var(--color-ok)"
            shape={(props: unknown) => <ExtraMark {...(props as { cx?: number; cy?: number; payload?: ChartDatum })} />}
            isAnimationActive={false}
            name="Extra payment"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
