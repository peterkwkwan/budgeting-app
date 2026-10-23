/**
 * Planner P0 projection math — monthly compound (grow) and amortization-lite (shrink).
 * No Monte Carlo. USD amounts as numbers (client-side).
 */

import type { PlanCadence } from '@/constants/planner';

export type PaceStatus = 'on_track' | 'behind' | 'ahead' | 'unknown';

/** Convert a planned contribution cadence to an equivalent monthly amount. */
export function monthlyFromCadence(
  amount: number,
  cadence: PlanCadence
): number {
  if (!(amount > 0)) return 0;
  switch (cadence) {
    case 'weekly':
      return (amount * 52) / 12;
    case 'biweekly':
      return (amount * 26) / 12;
    case 'monthly':
      return amount;
  }
}

export type ProjectVehicleInput = {
  balance: number;
  annualRatePercent: number;
  growthMode: 'grow' | 'shrink';
  /** Optional planned contribution (grow) or payment (shrink). */
  planAmount?: number | null;
  planCadence?: PlanCadence | null;
};

export type ProjectionPoint = {
  /** Months from now (0 = today). */
  month: number;
  /** Net assets: grow balances − debt balances. */
  netWorth: number;
  assets: number;
  debts: number;
};

/**
 * One month of grow (compound) or shrink (payment after interest).
 */
export function stepVehicleMonth(
  balance: number,
  annualRatePercent: number,
  growthMode: 'grow' | 'shrink',
  monthlyCashflow: number
): number {
  const r = Math.max(0, annualRatePercent) / 100 / 12;
  if (growthMode === 'grow') {
    const grown = balance * (1 + r);
    return round2(grown + Math.max(0, monthlyCashflow));
  }
  // shrink: interest accrues, then payment applied
  const withInterest = balance * (1 + r);
  const next = withInterest - Math.max(0, monthlyCashflow);
  return round2(Math.max(0, next));
}

/** Project a single vehicle over `months` (inclusive of month 0). */
export function projectVehicleBalances(
  vehicle: ProjectVehicleInput,
  months: number
): number[] {
  const n = Math.max(0, Math.floor(months));
  const monthly = monthlyCashflow(vehicle);
  const out: number[] = [round2(Math.max(0, vehicle.balance))];
  let bal = out[0]!;
  for (let m = 1; m <= n; m++) {
    bal = stepVehicleMonth(
      bal,
      vehicle.annualRatePercent,
      vehicle.growthMode,
      monthly
    );
    out.push(bal);
  }
  return out;
}

function monthlyCashflow(v: ProjectVehicleInput): number {
  if (
    v.planAmount != null &&
    v.planAmount > 0 &&
    v.planCadence != null
  ) {
    return monthlyFromCadence(v.planAmount, v.planCadence);
  }
  return 0;
}

/**
 * Aggregate net-worth path: sum grow balances − sum shrink balances each month.
 */
export function projectNetWorth(
  vehicles: ProjectVehicleInput[],
  months: number
): ProjectionPoint[] {
  const n = Math.max(0, Math.floor(months));
  const series = vehicles.map((v) => projectVehicleBalances(v, n));
  const points: ProjectionPoint[] = [];
  for (let m = 0; m <= n; m++) {
    let assets = 0;
    let debts = 0;
    vehicles.forEach((v, i) => {
      const bal = series[i]![m]!;
      if (v.growthMode === 'grow') assets += bal;
      else debts += bal;
    });
    points.push({
      month: m,
      assets: round2(assets),
      debts: round2(debts),
      netWorth: round2(assets - debts),
    });
  }
  return points;
}

/**
 * Required contribution per cadence to reach `target` from `current` by `targetDate`.
 * Simple linear (no interest) — Investor.gov-style savings-goal framing.
 */
export function requiredContribution(args: {
  targetAmount: number;
  currentSaved: number;
  targetDate: Date | string | null | undefined;
  cadence: PlanCadence;
  now?: Date;
}): number | null {
  const { targetAmount, currentSaved, targetDate, cadence } = args;
  const now = args.now ?? new Date();
  if (!targetDate) return null;
  const end =
    typeof targetDate === 'string' ? parseDateOnly(targetDate) : targetDate;
  if (!end || Number.isNaN(end.getTime())) return null;
  const remaining = Math.max(0, targetAmount - currentSaved);
  if (remaining <= 0) return 0;
  const ms = end.getTime() - startOfLocalDay(now).getTime();
  if (ms <= 0) return remaining;
  const days = ms / (24 * 60 * 60 * 1000);
  switch (cadence) {
    case 'weekly':
      return round2(remaining / Math.max(days / 7, 1 / 7));
    case 'biweekly':
      return round2(remaining / Math.max(days / 14, 1 / 14));
    case 'monthly':
      return round2(remaining / Math.max(days / 30.4375, 1 / 30.4375));
  }
}

/**
 * Linear pace vs schedule from goal `createdAt` → `targetDate`.
 * Compares current_saved to expected progress (0 → target).
 */
export function goalPace(args: {
  targetAmount: number;
  currentSaved: number;
  targetDate: Date | string | null | undefined;
  createdAt: Date | string;
  now?: Date;
}): { status: PaceStatus; expectedSaved: number; progressPct: number } {
  const target = Math.max(0, args.targetAmount);
  const current = Math.max(0, args.currentSaved);
  const progressPct =
    target > 0 ? Math.min(100, round2((current / target) * 100)) : 0;

  if (!args.targetDate) {
    return { status: 'unknown', expectedSaved: 0, progressPct };
  }

  const now = args.now ?? new Date();
  const start = toDate(args.createdAt);
  const end =
    typeof args.targetDate === 'string'
      ? parseDateOnly(args.targetDate)
      : args.targetDate;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { status: 'unknown', expectedSaved: 0, progressPct };
  }

  const total = end.getTime() - start.getTime();
  if (total <= 0) {
    const status: PaceStatus =
      current >= target ? 'ahead' : current > 0 ? 'behind' : 'behind';
    return { status, expectedSaved: target, progressPct };
  }

  const elapsed = Math.min(Math.max(now.getTime() - start.getTime(), 0), total);
  const expectedSaved = round2(target * (elapsed / total));
  const tol = Math.max(target * 0.05, 1);
  let status: PaceStatus = 'on_track';
  if (current >= expectedSaved + tol) status = 'ahead';
  else if (current <= expectedSaved - tol) status = 'behind';
  return { status, expectedSaved, progressPct };
}

/** Month index along a horizon when a goal target date falls (for chart markers). */
export function goalMarkerMonth(
  targetDate: Date | string | null | undefined,
  horizonMonths: number,
  now: Date = new Date()
): number | null {
  if (!targetDate) return null;
  const end =
    typeof targetDate === 'string' ? parseDateOnly(targetDate) : targetDate;
  if (!end || Number.isNaN(end.getTime())) return null;
  const days =
    (end.getTime() - startOfLocalDay(now).getTime()) / (24 * 60 * 60 * 1000);
  const month = Math.round(days / 30.4375);
  if (month < 0 || month > horizonMonths) return null;
  return month;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toDate(v: Date | string): Date | null {
  const d = typeof v === 'string' ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse `YYYY-MM-DD` as local calendar date at noon (avoid TZ edge). */
export function parseDateOnly(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) {
    const d = new Date(ymd);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  return new Date(y, mo - 1, day, 12, 0, 0, 0);
}

export function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
