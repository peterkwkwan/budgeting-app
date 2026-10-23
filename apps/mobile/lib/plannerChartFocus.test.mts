import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  chartableGoals,
  isChartableGoal,
  linkedGrowthVehicles,
  resolveChartFocus,
  resolveChartMode,
} from './plannerChartFocus.ts';

const vehicles = [
  { id: 'save', name: 'Savings', balance: 5000, growth_mode: 'grow' as const },
  { id: 'ira', name: 'IRA', balance: 12000, growth_mode: 'grow' as const },
  { id: 'mort', name: 'Mortgage', balance: 200000, growth_mode: 'shrink' as const },
];

test('linkedGrowthVehicles excludes shrink/debt', () => {
  const linked = linkedGrowthVehicles(
    { vehicle_ids: ['save', 'mort'] },
    vehicles
  );
  assert.deepEqual(
    linked.map((v) => v.id),
    ['save']
  );
});

test('isChartableGoal requires ≥1 growth link', () => {
  assert.equal(
    isChartableGoal({ vehicle_ids: ['mort'] }, vehicles),
    false
  );
  assert.equal(
    isChartableGoal({ vehicle_ids: [] }, vehicles),
    false
  );
  assert.equal(
    isChartableGoal({ vehicle_ids: ['save'] }, vehicles),
    true
  );
});

test('resolveChartMode prefers goal when chartable exists', () => {
  const goals = [
    {
      id: 'g1',
      name: 'House',
      target_amount: 50000,
      vehicle_ids: ['save'],
    },
  ];
  assert.equal(resolveChartMode(goals, vehicles), 'goal');
  assert.equal(resolveChartMode([], vehicles), 'vehicle');
  assert.equal(
    resolveChartMode(
      [{ id: 'g2', name: 'Debt', target_amount: 1, vehicle_ids: ['mort'] }],
      vehicles
    ),
    'vehicle'
  );
});

test('resolveChartFocus defaults last valid → first chartable → largest growth', () => {
  const goals = [
    {
      id: 'g1',
      name: 'House',
      target_amount: 50000,
      vehicle_ids: ['save'],
    },
    {
      id: 'g2',
      name: 'Trip',
      target_amount: 3000,
      vehicle_ids: ['ira'],
    },
  ];

  assert.deepEqual(
    resolveChartFocus({
      mode: 'goal',
      goals,
      vehicles,
      stored: { kind: 'goal', id: 'g2' },
    }),
    { kind: 'goal', id: 'g2' }
  );

  assert.deepEqual(
    resolveChartFocus({
      mode: 'goal',
      goals,
      vehicles,
      stored: { kind: 'goal', id: 'gone' },
    }),
    { kind: 'goal', id: 'g1' }
  );

  assert.deepEqual(
    resolveChartFocus({
      mode: 'vehicle',
      goals: [],
      vehicles,
      stored: null,
    }),
    { kind: 'vehicle', id: 'ira' } // largest growth balance
  );

  assert.deepEqual(
    resolveChartFocus({
      mode: 'vehicle',
      goals: [],
      vehicles,
      stored: { kind: 'vehicle', id: 'mort' },
    }),
    { kind: 'vehicle', id: 'mort' }
  );
});

test('chartableGoals filters correctly', () => {
  const goals = [
    { id: 'a', name: 'A', target_amount: 1, vehicle_ids: ['save'] },
    { id: 'b', name: 'B', target_amount: 1, vehicle_ids: [] },
    { id: 'c', name: 'C', target_amount: 1, vehicle_ids: ['mort'] },
  ];
  assert.deepEqual(
    chartableGoals(goals, vehicles).map((g) => g.id),
    ['a']
  );
});
