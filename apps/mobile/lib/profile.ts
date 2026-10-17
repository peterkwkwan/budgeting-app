import * as Localization from 'expo-localization';
import type { User } from '@supabase/supabase-js';

import { supabase } from './supabase';

export type Profile = {
  id: string;
  display_name: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export function deviceTimezone(): string {
  const calendars = Localization.getCalendars();
  return calendars[0]?.timeZone ?? 'UTC';
}

/**
 * Ensures a profiles row exists and records the device IANA timezone on first login.
 * Uses upsert so it is safe if the auth.users trigger already inserted a row.
 */
export async function ensureProfile(user: User): Promise<Profile | null> {
  const displayName =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
    user.email ||
    null;

  const timezone = deviceTimezone();

  const { data: existing, error: selectError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (selectError) {
    console.warn('[profile] select failed', selectError.message);
  }

  if (existing) {
    // Keep an existing timezone; only backfill if still the default and device knows better.
    if (existing.timezone === 'UTC' && timezone !== 'UTC') {
      const { data, error } = await supabase
        .from('profiles')
        .update({ timezone, display_name: existing.display_name ?? displayName })
        .eq('id', user.id)
        .select('*')
        .single();
      if (error) {
        console.warn('[profile] timezone backfill failed', error.message);
        return existing as Profile;
      }
      return data as Profile;
    }
    return existing as Profile;
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        display_name: displayName,
        timezone,
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single();

  if (error) {
    console.warn('[profile] upsert failed', error.message);
    return null;
  }

  return data as Profile;
}
