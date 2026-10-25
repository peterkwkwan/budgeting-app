import {
  categoriesForType,
  isValidCategory,
  type TransactionType,
} from '@/constants/categories';

/** Minimal shape for merging customs into pickers. */
export type CategoryCustom = {
  type: TransactionType;
  name: string;
  archived_at: string | null;
};

/** Active custom names for a type (picker order: system then customs). */
export function activeCustomNames(
  customs: CategoryCustom[],
  type: TransactionType
): string[] {
  return customs
    .filter((c) => c.type === type && !c.archived_at)
    .map((c) => c.name);
}

/** System + active customs for pickers. */
export function pickerCategories(
  type: TransactionType,
  customs: CategoryCustom[]
): string[] {
  return [...categoriesForType(type), ...activeCustomNames(customs, type)];
}

/** Valid if system or any custom (incl. archived) for that type. */
export function isAllowedCategory(
  type: TransactionType,
  category: string,
  customs: CategoryCustom[]
): boolean {
  if (isValidCategory(type, category)) return true;
  return customs.some((c) => c.type === type && c.name === category);
}
