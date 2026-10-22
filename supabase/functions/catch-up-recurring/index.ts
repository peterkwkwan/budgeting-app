/**
 * Callable Edge Function: same generation as cron, scoped to auth.uid().
 * Invoke on app foreground so missed cron still fills the 90-day horizon.
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

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ error: 'Supabase env missing' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization' }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin
    .from('recurring_series')
    .select(
      'id, user_id, amount, type, category, note, cadence, anchor_at, timezone, active'
    )
    .eq('user_id', user.id)
    .eq('active', true)
    .is('deleted_at', null);

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  const seriesList = (data ?? []) as RecurringSeriesRow[];
  const result = await generateForSeriesList(admin, seriesList);

  return jsonResponse({
    ok: true,
    user_id: user.id,
    ...result,
  });
});
