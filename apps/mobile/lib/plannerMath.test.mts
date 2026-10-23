import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
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
  const bal = stepVehicleMonth(1000, 12, 'grow', 100);
  // 1000 * 1.01 + 100 = 1110
  assert.equal(bal, 1110);
});

test('shrink applies interest then payment and floors at zero', () => {
  const bal = stepVehicleMonth(1000, 12, 'shrink', 200);
  // 1000 * 1.01 - 200 = 810
  assert.equal(bal, 810);
  assert.equal(stepVehicleMonth(50, 0, 'shrink', 100), 0);
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

test('goalPace ahead / behind / on_track', () => {
  const created = new Date(2026, 0, 1);
  const target = new Date(2026, 11, 31);
  const mid = new Date(2026, 6, 1);
  const behind = goalPace({
    targetAmount: 1200,
    currentSaved: 100,
    targetDate: target,
    createdAt: created,
    now: mid,
  });
  assert.equal(behind.status, 'behind');

  const ahead = goalPace({
    targetAmount: 1200,
    currentSaved: 1100,
    targetDate: target,
    createdAt: created,
    now: mid,
  });
  assert.equal(ahead.status, 'ahead');

  const unknown = goalPace({
    targetAmount: 1200,
    currentSaved: 200,
    targetDate: null,
    createdAt: created,
    now: mid,
  });
  assert.equal(unknown.status, 'unknown');
});
