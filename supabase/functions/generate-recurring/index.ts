/**
 * Cron Edge Function: materialize recurring ledger rows for all active series
 * through a rolling 90-day horizon (also backfills up to 90 days).
 *
 * Auth: Authorization Bearer must match RECURRING_CRON_SECRET (verify_jwt=false).
 * Uses service role to insert across users.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  generateForSeriesList,
  type RecurringSeriesRow,
} from '../_shared/recurring.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const cronSecret = Deno.env.get('RECURRING_CRON_SECRET');
  if (!cronSecret) {
    return jsonResponse(
      { error: 'RECURRING_CRON_SECRET is not configured' },
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

  const { data, error } = await admin
    .from('recurring_series')
    .select(
      'id, user_id, amount, type, category, note, cadence, anchor_at, timezone, active'
    )
    .eq('active', true)
    .is('deleted_at', null);

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  const seriesList = (data ?? []) as RecurringSeriesRow[];
  const result = await generateForSeriesList(admin, seriesList);

  return jsonResponse({
    ok: true,
    ...result,
  });
});
