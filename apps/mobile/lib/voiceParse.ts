/**
 * Best-effort parse of on-device STT transcript into a transaction draft.
 * User must confirm/edit before save — never auto-insert.
 */

import {
  categoriesForType,
  defaultCategory,
  type TransactionType,
} from '@/constants/categories';

export type VoiceDraft = {
  amount: string;
  type: TransactionType;
  category: string;
  note: string;
  transcript: string;
  /** `full` = amount parsed; `partial` = speak again or fill amount manually. */
  confidence: 'full' | 'partial';
};

/** Common spoken aliases → fixed category (expense unless income). */
const EXPENSE_ALIASES: Record<string, string> = {
  gas: 'Transport',
  fuel: 'Transport',
  uber: 'Transport',
  lyft: 'Transport',
  bus: 'Transport',
  train: 'Transport',
  metro: 'Transport',
  parking: 'Transport',
  coffee: 'Eating out',
  lunch: 'Eating out',
  dinner: 'Eating out',
  brunch: 'Eating out',
  restaurant: 'Eating out',
  takeout: 'Eating out',
  'take out': 'Eating out',
  'take-away': 'Eating out',
  groceries: 'Groceries',
  grocery: 'Groceries',
  supermarket: 'Groceries',
  rent: 'Rent and Bills',
  utilities: 'Rent and Bills',
  electric: 'Rent and Bills',
  electricity: 'Rent and Bills',
  wifi: 'Rent and Bills',
  internet: 'Rent and Bills',
  phone: 'Rent and Bills',
  vet: 'Pets',
  dog: 'Pets',
  cat: 'Pets',
  pet: 'Pets',
  clothes: 'Apparel',
  clothing: 'Apparel',
  shoes: 'Apparel',
  haircut: 'Beauty',
  makeup: 'Beauty',
  doctor: 'Health',
  pharmacy: 'Health',
  medicine: 'Health',
  school: 'Education',
  tuition: 'Education',
  gift: 'Gift',
  present: 'Gift',
  kids: 'Kids',
  childcare: 'Kids',
  gaming: 'Gaming',
  steam: 'Gaming',
  xbox: 'Gaming',
  playstation: 'Gaming',
  vacation: 'Vacation',
  travel: 'Vacation',
  hotel: 'Vacation',
  flight: 'Vacation',
  donation: 'Donation',
  charity: 'Donation',
  party: 'Social Life',
  drinks: 'Social Life',
  bar: 'Social Life',
  household: 'Household',
  cleaning: 'Household',
};

const INCOME_ALIASES: Record<string, string> = {
  salary: 'Salary',
  paycheck: 'Salary',
  wages: 'Salary',
  freelance: 'Freelance',
  contract: 'Freelance',
  consulting: 'Freelance',
};

const FILLER =
  /\b(um|uh|like|please|today|yesterday|just|about|around|roughly|dollars?|bucks|usd|dollar)\b/gi;

function detectType(lower: string): TransactionType {
  const incomeHit =
    /\b(income|earned|earning|salary|freelance|paycheck|wages|got paid|received|deposit|invoice)\b/.test(
      lower
    );
  const expenseHit =
    /\b(expense|spent|spend|bought|paid for|pay for|cost|costs)\b/.test(lower);
  if (incomeHit && !expenseHit) return 'income';
  if (/\b(salary|freelance|other income)\b/.test(lower)) return 'income';
  return 'expense';
}

function extractAmount(text: string): { value: number; raw: string } | null {
  const patterns = [
    /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/,
    /\b(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*(?:dollars?|bucks|usd)\b/i,
    /\b(?:spent|spend|paid|pay|bought|cost|costs|earned|received|got)\s+(?:\$\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\b/i,
    /\b(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\b/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const value = Number.parseFloat(m[1].replace(/,/g, ''));
    if (!(value > 0) || Number.isNaN(value)) continue;
    return { value: Math.round(value * 100) / 100, raw: m[0] };
  }
  return null;
}

export type VoiceCategoryExtras = {
  expense?: readonly string[];
  income?: readonly string[];
};

function categoriesWithExtras(
  type: TransactionType,
  extras?: VoiceCategoryExtras
): string[] {
  const custom = extras?.[type] ?? [];
  return [...categoriesForType(type), ...custom];
}

function matchCategory(
  lower: string,
  type: TransactionType,
  extras?: VoiceCategoryExtras
): { category: string; matched: string | null } {
  const cats = categoriesWithExtras(type, extras);
  let best: string | null = null;
  let bestLen = 0;
  for (const cat of cats) {
    const needle = cat.toLowerCase();
    if (lower.includes(needle) && needle.length > bestLen) {
      best = cat;
      bestLen = needle.length;
    }
  }
  if (best) return { category: best, matched: best.toLowerCase() };

  const aliases = type === 'income' ? INCOME_ALIASES : EXPENSE_ALIASES;
  let aliasHit: string | null = null;
  let aliasLen = 0;
  let aliasKey: string | null = null;
  for (const [key, cat] of Object.entries(aliases)) {
    if (!cats.includes(cat)) continue;
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lower) && key.length > aliasLen) {
      aliasHit = cat;
      aliasLen = key.length;
      aliasKey = key;
    }
  }
  if (aliasHit) return { category: aliasHit, matched: aliasKey };

  return { category: defaultCategory(type), matched: null };
}

function buildNote(
  transcript: string,
  amountRaw: string | null,
  matchedCategory: string | null
): string {
  let note = transcript;
  if (amountRaw) {
    note = note.replace(amountRaw, ' ');
  }
  if (matchedCategory) {
    note = note.replace(new RegExp(matchedCategory, 'ig'), ' ');
  }
  note = note
    .replace(
      /\b(expense|income|spent|spend|bought|paid for|pay for|paid|pay|cost|costs|earned|earning|got paid|received|deposit|for|on|at|the|a|an|my|of|to|from|dollars?|bucks|usd|\$)\b/gi,
      ' '
    )
    .replace(FILLER, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (note.length > 500) note = note.slice(0, 500);
  return note;
}

/** Parse free-form speech into a draft. Always returns a draft object when transcript is non-empty. */
export function parseVoiceTranscript(
  raw: string,
  extras?: VoiceCategoryExtras
): VoiceDraft | null {
  const transcript = raw.trim().replace(/\s+/g, ' ');
  if (!transcript) return null;

  const lower = transcript.toLowerCase();
  const type = detectType(lower);
  const amount = extractAmount(transcript);
  const { category, matched } = matchCategory(lower, type, extras);
  const note = buildNote(transcript, amount?.raw ?? null, matched);

  if (!amount) {
    return {
      amount: '',
      type,
      category,
      note: note || transcript.slice(0, 500),
      transcript,
      confidence: 'partial',
    };
  }

  return {
    amount: amount.value.toFixed(2),
    type,
    category,
    note,
    transcript,
    confidence: 'full',
  };
}

/** Short phrases to bias Android STT toward Fudget categories + money words. */
export function speechContextualHints(extras?: VoiceCategoryExtras): string[] {
  return [
    ...categoriesWithExtras('expense', extras),
    ...categoriesWithExtras('income', extras),
    'dollars',
    'spent',
    'income',
    'expense',
  ];
}
