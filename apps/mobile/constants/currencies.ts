/** Top-20 account currencies (Settings picker). Default HKD. */

export const ACCOUNT_CURRENCIES = [
  'HKD',
  'USD',
  'CNY',
  'EUR',
  'GBP',
  'JPY',
  'CAD',
  'AUD',
  'SGD',
  'CHF',
  'INR',
  'KRW',
  'TWD',
  'THB',
  'MYR',
  'PHP',
  'IDR',
  'NZD',
  'SEK',
  'NOK',
] as const;

export type AccountCurrency = (typeof ACCOUNT_CURRENCIES)[number];

export const DEFAULT_CURRENCY: AccountCurrency = 'HKD';

/** Zero-decimal cash currencies in our list. */
const ZERO_DECIMAL = new Set<AccountCurrency>(['JPY', 'KRW']);

const SYMBOLS: Record<AccountCurrency, string> = {
  HKD: 'HK$',
  USD: '$',
  CNY: '¥',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'CA$',
  AUD: 'A$',
  SGD: 'S$',
  CHF: 'CHF ',
  INR: '₹',
  KRW: '₩',
  TWD: 'NT$',
  THB: '฿',
  MYR: 'RM',
  PHP: '₱',
  IDR: 'Rp',
  NZD: 'NZ$',
  SEK: 'kr',
  NOK: 'kr',
};

const LABELS: Record<AccountCurrency, string> = {
  HKD: 'Hong Kong dollar',
  USD: 'US dollar',
  CNY: 'Chinese yuan',
  EUR: 'Euro',
  GBP: 'British pound',
  JPY: 'Japanese yen',
  CAD: 'Canadian dollar',
  AUD: 'Australian dollar',
  SGD: 'Singapore dollar',
  CHF: 'Swiss franc',
  INR: 'Indian rupee',
  KRW: 'South Korean won',
  TWD: 'New Taiwan dollar',
  THB: 'Thai baht',
  MYR: 'Malaysian ringgit',
  PHP: 'Philippine peso',
  IDR: 'Indonesian rupiah',
  NZD: 'New Zealand dollar',
  SEK: 'Swedish krona',
  NOK: 'Norwegian krone',
};

export function isAccountCurrency(value: unknown): value is AccountCurrency {
  return (
    typeof value === 'string' &&
    (ACCOUNT_CURRENCIES as readonly string[]).includes(value)
  );
}

export function parseAccountCurrency(value: unknown): AccountCurrency {
  if (isAccountCurrency(value)) return value;
  return DEFAULT_CURRENCY;
}

export function currencySymbol(code: AccountCurrency): string {
  return SYMBOLS[code];
}

export function currencyLabel(code: AccountCurrency): string {
  return LABELS[code];
}

export function currencyFractionDigits(code: AccountCurrency): number {
  return ZERO_DECIMAL.has(code) ? 0 : 2;
}

/** Picker row: "HKD — Hong Kong dollar" */
export function currencyPickerLabel(code: AccountCurrency): string {
  return `${code} — ${LABELS[code]}`;
}
