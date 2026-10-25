import type { TransactionType } from '@/constants/categories';
import { isSystemCategory } from '@/constants/categories';

import { supabase } from './supabase';

export {
  activeCustomNames,
  isAllowedCategory,
  pickerCategories,
} from './categoryPickers';

export type UserCategory = {
  id: string;
  user_id: string;
  type: TransactionType;
  name: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: Record<string, unknown>): UserCategory {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    type: row.type as TransactionType,
    name: String(row.name),
    archived_at: (row.archived_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listUserCategories(): Promise<UserCategory[]> {
  const { data, error } = await supabase
    .from('user_categories')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function createUserCategory(
  userId: string,
  type: TransactionType,
  name: string
): Promise<UserCategory> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Enter a category name.');
  if (trimmed.length > 40) throw new Error('Name must be 40 characters or fewer.');
  if (isSystemCategory(type, trimmed)) {
    throw new Error(`“${trimmed}” is a built-in category.`);
  }

  const { data, error } = await supabase
    .from('user_categories')
    .insert({ user_id: userId, type, name: trimmed })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`You already have a category named “${trimmed}”.`);
    }
    throw new Error(error.message);
  }
  return mapRow(data as Record<string, unknown>);
}

export async function renameUserCategory(
  id: string,
  newName: string
): Promise<UserCategory> {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('Enter a category name.');

  const { data, error } = await supabase.rpc('rename_user_category', {
    p_id: id,
    p_new_name: trimmed,
  });

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function archiveUserCategory(id: string): Promise<UserCategory> {
  const { data, error } = await supabase
    .from('user_categories')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .is('archived_at', null)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function unarchiveUserCategory(id: string): Promise<UserCategory> {
  const { data, error } = await supabase
    .from('user_categories')
    .update({ archived_at: null })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export const userCategoryKeys = {
  all: ['user-categories'] as const,
  list: () => [...userCategoryKeys.all, 'list'] as const,
};
