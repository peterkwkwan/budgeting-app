import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clampDayInMonth,
  dateKeyFromFocusDay,
  daysInMonth,
  monthGridCells,
  weekdayMon0,
  weekdaySun0,
  weekDaysAround,
} from './transactionsDateView.ts';

describe('transactionsDateView', () => {
  it('daysInMonth handles leap February', () => {
    assert.equal(daysInMonth(2024, 2), 29);
    assert.equal(daysInMonth(2025, 2), 28);
    assert.equal(daysInMonth(2026, 10), 31);
  });

  it('weekdaySun0 for Oct 2026 (Thu start)', () => {
    // 2026-10-01 is Thursday → 4
    assert.equal(weekdaySun0(2026, 10, 1), 4);
    assert.equal(weekdayMon0(2026, 10, 1), 3);
  });

  it('monthGridCells pads Sunday-start October 2026', () => {
    const cells = monthGridCells({ year: 2026, month: 10 });
    assert.equal(cells[0], null);
    assert.equal(cells[1], null);
    assert.equal(cells[2], null);
    assert.equal(cells[3], null);
    assert.equal(cells[4], 1);
    assert.equal(cells.filter((c) => c != null).length, 31);
    assert.equal(cells.length % 7, 0);
  });

  it('weekDaysAround uses Monday-start week', () => {
    // Oct 23 2026 is Friday → week Mon 19 … Sun 25
    const week = weekDaysAround({ year: 2026, month: 10 }, 23);
    assert.equal(week.length, 7);
    assert.equal(week[0]?.day, 19);
    assert.equal(week[0]?.inFocusMonth, true);
    assert.equal(week[6]?.day, 25);
  });

  it('clampDayInMonth and dateKeyFromFocusDay', () => {
    assert.equal(clampDayInMonth(2026, 2, 31), 28);
    assert.equal(dateKeyFromFocusDay({ year: 2026, month: 10 }, 3), '2026-10-03');
  });
});
