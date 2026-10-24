import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  goalEffectiveSaved,
  goalPace,
  monthlyFromCadence,
  projectNetWorth,
  projectVehicleBalances,
  requiredContribution,
  stepVehicleMonth,
} from './plannerMath.ts';

test('monthlyFromCadence converts weekly and biweekly', () => {
  assert.equal(monthlyFromCadence(100, 'monthly'), 100);
  assert.ok(Math.abs(monthlyFromCadence(50, 'weekly') - (50 * 52) / 12) < 1e-9);
  assert.ok(Math.abs(monthlyFromCadence(100, 'biweekly') - (100 * 26) / 12) < 1e-9);
});

test('grow compounds monthly and adds contributions', () => {
  const bal = stepVehicleMonth(1000, 12, 'grow', 100, 'monthly', 1);
  // 1000 * 1.01 + 100 = 1110
  assert.equal(bal, 1110);
});

test('shrink applies interest then payment and floors at zero', () => {
  const bal = stepVehicleMonth(1000, 12, 'shrink', 200, 'monthly', 1);
  // 1000 * 1.01 - 200 = 810
  assert.equal(bal, 810);
  assert.equal(stepVehicleMonth(50, 0, 'shrink', 100, 'monthly', 1), 0);
});

test('yearly compound applies full rate only on month 12', () => {
  const m1 = stepVehicleMonth(1000, 12, 'grow', 0, 'yearly', 1);
  assert.equal(m1, 1000); // no interest yet
  const m12 = stepVehicleMonth(1000, 12, 'grow', 0, 'yearly', 12);
  assert.equal(m12, 1120); // 1000 * 1.12
});

test('projectVehicleBalances length is months+1', () => {
  const series = projectVehicleBalances(
    {
      balance: 1000,
      annualRatePercent: 0,
      growthMode: 'grow',
      planAmount: 100,
      planCadence: 'monthly',
    },
    3
  );
  assert.deepEqual(series, [1000, 1100, 1200, 1300]);
});

test('projectNetWorth subtracts debts from assets', () => {
  const points = projectNetWorth(
    [
      {
        balance: 5000,
        annualRatePercent: 0,
        growthMode: 'grow',
        planAmount: null,
        planCadence: null,
      },
      {
        balance: 2000,
        annualRatePercent: 0,
        growthMode: 'shrink',
        planAmount: 500,
        planCadence: 'monthly',
      },
    ],
    2
  );
  assert.equal(points[0]!.netWorth, 3000);
  assert.equal(points[1]!.debts, 1500);
  assert.equal(points[1]!.netWorth, 3500);
  assert.equal(points[2]!.debts, 1000);
  assert.equal(points[2]!.netWorth, 4000);
});

test('requiredContribution monthly over ~12 months', () => {
  const now = new Date(2026, 0, 1);
  const target = new Date(2027, 0, 1);
  const req = requiredContribution({
    targetAmount: 1200,
    currentSaved: 0,
    targetDate: target,
    cadence: 'monthly',
    now,
  });
  assert.ok(req != null);
  assert.ok(req! > 90 && req! < 110);
});

test('goalEffectiveSaved uses linked vehicle balances (option A)', () => {
  assert.equal(
    goalEffectiveSaved({
      currentSaved: 100,
      vehicleIds: [],
      vehicles: [{ id: 'a', balance: 500 }],
    }),
    100
  );
  assert.equal(
    goalEffectiveSaved({
      currentSaved: 100,
      vehicleIds: ['a', 'b'],
      vehicles: [
        { id: 'a', balance: 400 },
        { id: 'b', balance: 150 },
        { id: 'c', balance: 999 },
      ],
    }),
    550
  );
});

test('goalPace uses projection to target date (not calendar % elapsed)', () => {
  const created = new Date(2026, 0, 1);
  const now = new Date(2026, 0, 1);
  // 6 months out, $100 saved, no growth/plan → still $100 vs $1200 target → behind
  const behind = goalPace({
    targetAmount: 1200,
    currentSaved: 100,
    targetDate: new Date(2026, 6, 1),
    createdAt: created,
    now,
  });
  assert.equal(behind.status, 'behind');
  assert.equal(behind.progressPct, roundish(100 / 1200 * 100));

  // Same timeline with a plan that covers the gap → ahead / on_track
  const withPlan = goalPace({
    targetAmount: 1200,
    currentSaved: 100,
    targetDate: new Date(2026, 6, 1),
    createdAt: created,
    now,
    planAmount: 200,
    planCadence: 'monthly',
  });
  assert.ok(withPlan.status === 'ahead' || withPlan.status === 'on_track');
  assert.ok(withPlan.expectedSaved >= 1200 - Math.max(1200 * 0.05, 1));

  // Already above target today → ahead even with distant date
  const ahead = goalPace({
    targetAmount: 1200,
    currentSaved: 1500,
    targetDate: new Date(2026, 11, 31),
    createdAt: created,
    now,
  });
  assert.equal(ahead.status, 'ahead');
  assert.equal(ahead.progressPct, 100);

  const unknown = goalPace({
    targetAmount: 1200,
    currentSaved: 200,
    targetDate: null,
    createdAt: created,
    now,
  });
  assert.equal(unknown.status, 'unknown');
});

/** Peter repro: $500k @ 8%/yr linked, $5M target in 25y → ~$3.42M projected → Behind (not Ahead). */
test('goalPace retirement linked IBKR: behind when projection misses target', () => {
  const now = new Date(2026, 9, 23);
  const target = new Date(2051, 9, 23); // 25y
  const pace = goalPace({
    targetAmount: 5_000_000,
    currentSaved: 500_000,
    targetDate: target,
    createdAt: now, // newly created — old linear rule wrongly said Ahead
    now,
    linkedVehicles: [
      {
        balance: 500_000,
        annualRatePercent: 8,
        growthMode: 'grow',
        compoundPeriod: 'yearly',
        planAmount: null,
        planCadence: null,
      },
    ],
  });
  assert.equal(pace.progressPct, 10); // 500k / 5M — balance progress, not pace
  assert.ok(
    pace.expectedSaved > 3_000_000 && pace.expectedSaved < 3_600_000,
    `projected ~3.42M, got ${pace.expectedSaved}`
  );
  assert.equal(pace.status, 'behind');
});

test('goalPace linked account with contributions can be ahead', () => {
  const now = new Date(2026, 0, 1);
  const pace = goalPace({
    targetAmount: 100_000,
    currentSaved: 50_000,
    targetDate: new Date(2028, 0, 1),
    now,
    linkedVehicles: [
      {
        balance: 50_000,
        annualRatePercent: 8,
        growthMode: 'grow',
        compoundPeriod: 'yearly',
        planAmount: 2_000,
        planCadence: 'monthly',
      },
    ],
  });
  assert.ok(pace.expectedSaved >= 100_000);
  assert.ok(pace.status === 'ahead' || pace.status === 'on_track');
});

function roundish(n: number): number {
  return Math.round(n * 100) / 100;
}
