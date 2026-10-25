/**
 * Cron Edge Function: hard-delete expired account wipe backups (30-day legal hold).
 *
 * Auth: Authorization Bearer must match ACCOUNT_BACKUP_CRON_SECRET
 * (falls back to RECURRING_CRON_SECRET so one secret can drive both crons).
 * verify_jwt = false; uses service role for purge RPC.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const cronSecret =
    Deno.env.get('ACCOUNT_BACKUP_CRON_SECRET') ??
    Deno.env.get('RECURRING_CRON_SECRET');
  if (!cronSecret) {
    return jsonResponse(
      {
        error:
          'ACCOUNT_BACKUP_CRON_SECRET or RECURRING_CRON_SECRET is not configured',
      },
      500
    );
  }

  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const headerSecret = req.headers.get('x-cron-secret') ?? '';
  if (token !== cronSecret && headerSecret !== cronSecret) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Supabase env missing' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc('purge_expired_account_backups');

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({
    ok: true,
    purged: typeof data === 'number' ? data : Number(data ?? 0),
  });
});
