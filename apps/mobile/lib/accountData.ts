import { supabase } from './supabase';

export {
  DELETE_CONFIRM_PHRASE,
  WIPE_CONFIRM_PHRASE,
  formatBackupDeadline,
  matchesConfirmPhrase,
} from './accountConfirm';

export type AccountBackupStatus = {
  hasBackup: boolean;
  wipedAt: string | null;
  expiresAt: string | null;
  restoreAvailable: boolean;
};

export type WipeResult = {
  wipedAt: string;
  expiresAt: string;
};

export type RestoreResult = {
  wipedAt: string;
  restoredAt: string;
};

type BackupStatusRow = {
  has_backup: boolean;
  wiped_at: string | null;
  expires_at: string | null;
  restore_available: boolean;
};

function mapBackupStatus(row: BackupStatusRow | null | undefined): AccountBackupStatus {
  if (!row || !row.has_backup || !row.restore_available) {
    return {
      hasBackup: false,
      wipedAt: null,
      expiresAt: null,
      restoreAvailable: false,
    };
  }
  return {
    hasBackup: true,
    wipedAt: row.wiped_at,
    expiresAt: row.expires_at,
    restoreAvailable: true,
  };
}

/** Fetch whether a 30-day wipe backup exists for the signed-in user. */
export async function getAccountBackupStatus(): Promise<AccountBackupStatus> {
  const { data, error } = await supabase.rpc('get_account_backup_status');
  if (error) {
    throw new Error(error.message);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return mapBackupStatus(row as BackupStatusRow | null | undefined);
}

/** Snapshot product data, clear ledger/recurring/planner, unlink partner; keep Auth. */
export async function wipeMyData(): Promise<WipeResult> {
  const { data, error } = await supabase.rpc('wipe_my_data');
  if (error) {
    throw new Error(error.message);
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { wiped_at: string; expires_at: string }
    | undefined;
  if (!row?.wiped_at || !row?.expires_at) {
    throw new Error('Wipe did not return a backup window.');
  }
  return { wipedAt: row.wiped_at, expiresAt: row.expires_at };
}

/**
 * Replace current product data with the wipe backup (discards post-wipe rows).
 * Fails if the 30-day window ended.
 */
export async function restoreMyData(): Promise<RestoreResult> {
  const { data, error } = await supabase.rpc('restore_my_data');
  if (error) {
    throw new Error(error.message);
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { wiped_at: string; restored_at: string }
    | undefined;
  if (!row?.wiped_at || !row?.restored_at) {
    throw new Error('Restore did not complete.');
  }
  return { wipedAt: row.wiped_at, restoredAt: row.restored_at };
}

/**
 * Permanently delete Auth user + all data (Play account deletion).
 * Calls the delete-account Edge Function (service role deletes auth.users).
 */
export async function deleteMyAccount(): Promise<void> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(sessionError.message);
  }
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error('Not signed in.');
  }

  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (error) {
    throw new Error(error.message);
  }
  if (data && typeof data === 'object' && 'error' in data) {
    const message = (data as { error?: string }).error;
    if (message) throw new Error(message);
  }
}
