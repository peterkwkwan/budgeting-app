/** Fixed category lists — match pm-triage MVP contract. Do not invent customs in M1. */

export const EXPENSE_CATEGORIES = [
  'Groceries',
  'Social Life',
  'Pets',
  'Transport',
  'Household',
  'Apparel',
  'Beauty',
  'Health',
  'Education',
  'Gift',
  'Other',
  'Kids',
  'Gaming',
  'Rent and Bills',
  'Eating out',
  'Vacation',
  'Donation',
] as const;

export const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Other income'] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type TransactionCategory = ExpenseCategory | IncomeCategory;
export type TransactionType = 'expense' | 'income';

export function categoriesForType(type: TransactionType): readonly string[] {
  return type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
}

export function isValidCategory(type: TransactionType, category: string): boolean {
  return (categoriesForType(type) as readonly string[]).includes(category);
}

export function defaultCategory(type: TransactionType): TransactionCategory {
  return type === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0];
}
