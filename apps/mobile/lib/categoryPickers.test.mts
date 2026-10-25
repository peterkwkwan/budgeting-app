import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  activeCustomNames,
  isAllowedCategory,
  pickerCategories,
  type CategoryCustom,
} from './categoryPickers.ts';

function cat(
  partial: Pick<CategoryCustom, 'type' | 'name'> & Partial<CategoryCustom>
): CategoryCustom {
  return {
    archived_at: partial.archived_at ?? null,
    ...partial,
  };
}

test('pickerCategories appends active customs after system', () => {
  const customs = [
    cat({ type: 'expense', name: 'Bubble tea' }),
    cat({ type: 'expense', name: 'Old', archived_at: '2026-02-01T00:00:00Z' }),
    cat({ type: 'income', name: 'Side hustle' }),
  ];
  const expense = pickerCategories('expense', customs);
  assert.equal(expense[0], 'Groceries');
  assert.ok(expense.includes('Bubble tea'));
  assert.equal(expense.includes('Old'), false);
  assert.equal(expense.includes('Side hustle'), false);

  const income = pickerCategories('income', customs);
  assert.ok(income.includes('Salary'));
  assert.ok(income.includes('Side hustle'));
});

test('isAllowedCategory accepts system and archived customs', () => {
  const customs = [
    cat({ type: 'expense', name: 'Old', archived_at: '2026-02-01T00:00:00Z' }),
  ];
  assert.equal(isAllowedCategory('expense', 'Groceries', customs), true);
  assert.equal(isAllowedCategory('expense', 'Old', customs), true);
  assert.equal(isAllowedCategory('expense', 'Nope', customs), false);
});

test('activeCustomNames filters type and archive', () => {
  const customs = [
    cat({ type: 'expense', name: 'A' }),
    cat({ type: 'expense', name: 'B', archived_at: '2026-02-01T00:00:00Z' }),
  ];
  assert.deepEqual(activeCustomNames(customs, 'expense'), ['A']);
});
