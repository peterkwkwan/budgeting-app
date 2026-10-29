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
  return extractDigitAmount(text) ?? extractSpokenAmount(text);
}

function extractDigitAmount(text: string): { value: number; raw: string } | null {
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

const SPOKEN_ONES: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const SPOKEN_TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const MONEY_SUFFIX = new Set(['dollar', 'dollars', 'bucks', 'usd']);
const MONEY_PREFIX = new Set([
  'spent',
  'spend',
  'paid',
  'pay',
  'bought',
  'cost',
  'costs',
  'earned',
  'received',
  'got',
]);

type SpokenToken = { word: string; start: number; end: number };

/** On-device STT often returns "thirty" instead of "30". Hyphens keep indexes aligned. */
function spokenTokens(text: string): SpokenToken[] {
  const normalized = text.replace(/-/g, ' ');
  const tokens: SpokenToken[] = [];
  const re = /[a-z0-9]+/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalized))) {
    tokens.push({
      word: match[0].toLowerCase(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tokens;
}

function isNumberWord(word: string | undefined): boolean {
  if (!word) return false;
  return (
    word in SPOKEN_ONES ||
    word in SPOKEN_TENS ||
    word === 'hundred' ||
    word === 'thousand' ||
    word === 'a' ||
    word === 'an'
  );
}

function parseSpokenNumber(
  tokens: SpokenToken[],
  start: number
): { value: number; next: number } | null {
  let total = 0;
  let current = 0;
  let saw = false;
  let j = start;
  while (j < tokens.length) {
    const word = tokens[j].word;
    if (word === 'and') {
      if (!saw || !isNumberWord(tokens[j + 1]?.word)) break;
      j++;
      continue;
    }
    if (
      (word === 'a' || word === 'an') &&
      (tokens[j + 1]?.word === 'hundred' || tokens[j + 1]?.word === 'thousand')
    ) {
      current += 1;
      saw = true;
      j++;
      continue;
    }
    if (word in SPOKEN_ONES) {
      current += SPOKEN_ONES[word];
      saw = true;
      j++;
      continue;
    }
    if (word in SPOKEN_TENS) {
      current += SPOKEN_TENS[word];
      saw = true;
      j++;
      continue;
    }
    if (word === 'hundred') {
      current = (current || 1) * 100;
      saw = true;
      j++;
      continue;
    }
    if (word === 'thousand') {
      total += (current || 1) * 1000;
      current = 0;
      saw = true;
      j++;
      continue;
    }
    break;
  }
  if (!saw) return null;
  const value = total + current;
  if (!(value > 0)) return null;
  return { value, next: j };
}

/**
 * Spoken money, e.g. "thirty dollars", "twenty-five bucks",
 * "spent forty five", "thirty dollars and fifty cents".
 */
function extractSpokenAmount(text: string): { value: number; raw: string } | null {
  const tokens = spokenTokens(text);
  for (let i = 0; i < tokens.length; i++) {
    const parsed = parseSpokenNumber(tokens, i);
    if (!parsed) continue;
    const suffix = tokens[parsed.next]?.word;
    const prefix = tokens[i - 1]?.word;
    const hasSuffix = suffix != null && MONEY_SUFFIX.has(suffix);
    const hasPrefix = prefix != null && MONEY_PREFIX.has(prefix);
    if (!hasSuffix && !hasPrefix) continue;

    let value = parsed.value;
    let endIndex = hasSuffix ? parsed.next : parsed.next - 1;
    let cursor = hasSuffix ? parsed.next + 1 : parsed.next;
    if (tokens[cursor]?.word === 'and') cursor++;
    const cents = parseSpokenNumber(tokens, cursor);
    const centWord = cents ? tokens[cents.next]?.word : undefined;
    if (cents && cents.value < 100 && (centWord === 'cent' || centWord === 'cents')) {
      value = Math.round((value + cents.value / 100) * 100) / 100;
      endIndex = cents.next;
    }

    return {
      value,
      raw: text.slice(tokens[i].start, tokens[endIndex].end),
    };
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
