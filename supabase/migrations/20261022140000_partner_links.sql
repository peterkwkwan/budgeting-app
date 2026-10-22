-- M4: partner_links (invite code) + security-definer RPCs for invite/accept/unlink
-- and aggregate stats (category totals + counts only — never partner txn rows/notes).
-- Founder: apply after M0–M3 migrations (see root README).

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.partner_links (
  id uuid primary key default gen_random_uuid(),
  -- Creator of a pending invite; for active pairs, the lower uuid of the two.
  user_a uuid not null references public.profiles (id) on delete cascade,
  -- Null while pending; set on accept. For active pairs, the higher uuid.
  user_b uuid references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  invite_code text,
  created_at timestamptz not null default now(),
  linked_at timestamptz,
  ended_at timestamptz,
  constraint partner_links_status_valid check (
    status in ('pending', 'active', 'ended')
  ),
  constraint partner_links_pending_shape check (
    (status = 'pending' and user_b is null and invite_code is not null)
    or (status = 'active' and user_b is not null and user_a < user_b)
    or (status = 'ended')
  ),
  constraint partner_links_no_self check (
    user_b is null or user_a <> user_b
  )
);

comment on table public.partner_links is
  'Pair-only partner link; pending uses invite_code; active has ordered user_a < user_b';
comment on column public.partner_links.invite_code is
  'Short code for pending invites; cleared or retained after accept (not required when active)';
comment on column public.partner_links.status is
  'pending | active | ended — ended links hide aggregate UI immediately';

create unique index if not exists partner_links_invite_code_pending_uidx
  on public.partner_links (invite_code)
  where status = 'pending' and invite_code is not null;

-- At most one active link per ordered pair
create unique index if not exists partner_links_active_pair_uidx
  on public.partner_links (user_a, user_b)
  where status = 'active';

-- A user may participate in at most one non-ended link (as a or b)
create unique index if not exists partner_links_user_a_open_uidx
  on public.partner_links (user_a)
  where status in ('pending', 'active');

create unique index if not exists partner_links_user_b_open_uidx
  on public.partner_links (user_b)
  where status = 'active' and user_b is not null;

create index if not exists partner_links_user_a_idx on public.partner_links (user_a);
create index if not exists partner_links_user_b_idx on public.partner_links (user_b)
  where user_b is not null;

alter table public.partner_links enable row level security;

-- Members may read their own links (for UI). Mutations go through RPCs only.
drop policy if exists "partner_links_select_member" on public.partner_links;
create policy "partner_links_select_member"
  on public.partner_links
  for select
  to authenticated
  using (
    auth.uid() = user_a
    or auth.uid() = user_b
  );

revoke insert, update, delete on public.partner_links from authenticated, anon, public;
grant select on public.partner_links to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public._partner_new_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  -- Ambiguous-safe alphabet (no 0/O/1/I/L)
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  entropy bytea;
  i int;
  n int;
begin
  for i in 1..32 loop
    candidate := '';
    -- md5 entropy avoids pgcrypto search_path quirks on hosted Supabase
    entropy := decode(
      md5(gen_random_uuid()::text || clock_timestamp()::text || i::text),
      'hex'
    );
    n := 0;
    while char_length(candidate) < 8 loop
      candidate := candidate || substr(
        alphabet,
        1 + (get_byte(entropy, n % length(entropy)) % char_length(alphabet)),
        1
      );
      n := n + 1;
      if n >= length(entropy) then
        entropy := decode(
          md5(gen_random_uuid()::text || clock_timestamp()::text || n::text),
          'hex'
        );
        n := 0;
      end if;
    end loop;
    if not exists (
      select 1
      from public.partner_links pl
      where pl.status = 'pending'
        and pl.invite_code = candidate
    ) then
      return candidate;
    end if;
  end loop;
  raise exception 'Could not allocate invite code';
end;
$$;

revoke all on function public._partner_new_invite_code() from public, anon, authenticated;

create or replace function public._partner_user_is_linked(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.partner_links pl
    where pl.status in ('pending', 'active')
      and (pl.user_a = p_user or pl.user_b = p_user)
  );
$$;

revoke all on function public._partner_user_is_linked(uuid) from public, anon, authenticated;

-- Active partner ids for auth.uid(), or nulls if not linked.
create or replace function public._partner_active_member_ids()
returns table (member_a uuid, member_b uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select pl.user_a, pl.user_b
  from public.partner_links pl
  where pl.status = 'active'
    and (pl.user_a = auth.uid() or pl.user_b = auth.uid())
  limit 1;
end;
$$;

revoke all on function public._partner_active_member_ids() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Invite / accept / unlink RPCs
-- ---------------------------------------------------------------------------

create or replace function public.partner_create_invite()
returns table (
  id uuid,
  status text,
  invite_code text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_row public.partner_links%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Already active with someone
  if exists (
    select 1 from public.partner_links pl
    where pl.status = 'active'
      and (pl.user_a = v_uid or pl.user_b = v_uid)
  ) then
    raise exception 'Already paired with a partner';
  end if;

  -- Reuse existing pending invite for this user (refresh code)
  select * into v_row
  from public.partner_links pl
  where pl.status = 'pending' and pl.user_a = v_uid
  for update;

  if found then
    v_code := public._partner_new_invite_code();
    update public.partner_links
    set invite_code = v_code,
        created_at = now()
    where public.partner_links.id = v_row.id
    returning * into v_row;

    return query
    select v_row.id, v_row.status, v_row.invite_code, v_row.created_at;
    return;
  end if;

  v_code := public._partner_new_invite_code();
  insert into public.partner_links (user_a, user_b, status, invite_code)
  values (v_uid, null, 'pending', v_code)
  returning * into v_row;

  return query
  select v_row.id, v_row.status, v_row.invite_code, v_row.created_at;
end;
$$;

comment on function public.partner_create_invite() is
  'Create or refresh a pending invite code for auth.uid(); pair-only';

create or replace function public.partner_accept_invite(p_code text)
returns table (
  id uuid,
  status text,
  partner_id uuid,
  partner_display_name text,
  linked_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_row public.partner_links%rowtype;
  v_creator uuid;
  v_a uuid;
  v_b uuid;
  v_partner_name text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_code := upper(trim(coalesce(p_code, '')));
  if v_code = '' or char_length(v_code) < 6 then
    raise exception 'Enter a valid invite code';
  end if;

  if public._partner_user_is_linked(v_uid) then
    raise exception 'You are already paired or have a pending invite';
  end if;

  select * into v_row
  from public.partner_links pl
  where pl.status = 'pending'
    and pl.invite_code = v_code
  for update;

  if not found then
    raise exception 'Invite code not found or already used';
  end if;

  v_creator := v_row.user_a;
  if v_creator = v_uid then
    raise exception 'You cannot accept your own invite';
  end if;

  -- Creator already holds this pending row; unique indexes prevent a second open link.

  if v_creator < v_uid then
    v_a := v_creator;
    v_b := v_uid;
  else
    v_a := v_uid;
    v_b := v_creator;
  end if;

  update public.partner_links
  set
    user_a = v_a,
    user_b = v_b,
    status = 'active',
    invite_code = null,
    linked_at = now()
  where public.partner_links.id = v_row.id
  returning * into v_row;

  select coalesce(nullif(trim(p.display_name), ''), 'Partner')
  into v_partner_name
  from public.profiles p
  where p.id = v_creator;

  return query
  select
    v_row.id,
    v_row.status,
    v_creator,
    coalesce(v_partner_name, 'Partner'),
    v_row.linked_at;
end;
$$;

comment on function public.partner_accept_invite(text) is
  'Redeem invite code → active pair; rejects if either side already linked';

create or replace function public.partner_unlink()
returns table (
  id uuid,
  status text,
  ended_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.partner_links%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.partner_links pl
  where pl.status in ('pending', 'active')
    and (pl.user_a = v_uid or pl.user_b = v_uid)
  for update;

  if not found then
    raise exception 'No partner link to unlink';
  end if;

  update public.partner_links
  set
    status = 'ended',
    ended_at = now(),
    invite_code = null
  where public.partner_links.id = v_row.id
  returning * into v_row;

  return query
  select v_row.id, v_row.status, v_row.ended_at;
end;
$$;

comment on function public.partner_unlink() is
  'End pending or active link for auth.uid(); aggregate UI must hide immediately';

create or replace function public.partner_get_link()
returns table (
  id uuid,
  status text,
  invite_code text,
  is_creator boolean,
  partner_id uuid,
  partner_display_name text,
  created_at timestamptz,
  linked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.partner_links%rowtype;
  v_partner uuid;
  v_name text;
  v_creator boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from public.partner_links pl
  where pl.status in ('pending', 'active')
    and (pl.user_a = v_uid or pl.user_b = v_uid)
  limit 1;

  if not found then
    return;
  end if;

  if v_row.status = 'pending' then
    v_creator := (v_row.user_a = v_uid);
    return query
    select
      v_row.id,
      v_row.status,
      case when v_creator then v_row.invite_code else null end,
      v_creator,
      null::uuid,
      null::text,
      v_row.created_at,
      v_row.linked_at;
    return;
  end if;

  -- active
  v_partner := case
    when v_row.user_a = v_uid then v_row.user_b
    else v_row.user_a
  end;

  select coalesce(nullif(trim(p.display_name), ''), 'Partner')
  into v_name
  from public.profiles p
  where p.id = v_partner;

  return query
  select
    v_row.id,
    v_row.status,
    null::text,
    false,
    v_partner,
    coalesce(v_name, 'Partner'),
    v_row.created_at,
    v_row.linked_at;
end;
$$;

comment on function public.partner_get_link() is
  'Current pending or active partner link for auth.uid(); empty if none';

grant execute on function public.partner_create_invite() to authenticated;
grant execute on function public.partner_accept_invite(text) to authenticated;
grant execute on function public.partner_unlink() to authenticated;
grant execute on function public.partner_get_link() to authenticated;

revoke all on function public.partner_create_invite() from public;
revoke all on function public.partner_accept_invite(text) from public;
revoke all on function public.partner_unlink() from public;
revoke all on function public.partner_get_link() from public;

-- ---------------------------------------------------------------------------
-- Aggregate stats RPCs (security definer; returns aggregates only)
-- Each member's recurring rows use that member's profile timezone.
-- ---------------------------------------------------------------------------

create or replace function public.stats_aggregate_by_category(
  p_type text,
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  category text,
  type text,
  sum numeric,
  count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_a uuid;
  v_b uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_type is null or p_type not in ('expense', 'income') then
    raise exception 'p_type must be expense or income';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'Invalid period bounds';
  end if;

  select member_a, member_b into v_a, v_b
  from public._partner_active_member_ids();

  if v_a is null or v_b is null then
    raise exception 'Not paired';
  end if;

  return query
  select
    t.category,
    t.type,
    coalesce(sum(t.amount), 0)::numeric as sum,
    count(*)::bigint as count
  from public.transactions t
  join public.profiles p on p.id = t.user_id
  where t.user_id in (v_a, v_b)
    and t.deleted_at is null
    and t.type = p_type
    and t.occurred_at >= p_start
    and t.occurred_at < p_end
    and (
      t.recurring_series_id is null
      or (t.occurred_at at time zone coalesce(nullif(trim(p.timezone), ''), 'UTC'))::date
         <= (now() at time zone coalesce(nullif(trim(p.timezone), ''), 'UTC'))::date
    )
  group by t.category, t.type
  order by sum desc, t.category asc;
end;
$$;

comment on function public.stats_aggregate_by_category(text, timestamptz, timestamptz) is
  'M4 pair category totals for both members; aggregates only — never txn rows/notes';

create or replace function public.stats_aggregate_totals(
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  expense_sum numeric,
  income_sum numeric,
  expense_count bigint,
  income_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_a uuid;
  v_b uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'Invalid period bounds';
  end if;

  select member_a, member_b into v_a, v_b
  from public._partner_active_member_ids();

  if v_a is null or v_b is null then
    raise exception 'Not paired';
  end if;

  return query
  select
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::numeric as expense_sum,
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::numeric as income_sum,
    count(*) filter (where t.type = 'expense')::bigint as expense_count,
    count(*) filter (where t.type = 'income')::bigint as income_count
  from public.transactions t
  join public.profiles p on p.id = t.user_id
  where t.user_id in (v_a, v_b)
    and t.deleted_at is null
    and t.occurred_at >= p_start
    and t.occurred_at < p_end
    and (
      t.recurring_series_id is null
      or (t.occurred_at at time zone coalesce(nullif(trim(p.timezone), ''), 'UTC'))::date
         <= (now() at time zone coalesce(nullif(trim(p.timezone), ''), 'UTC'))::date
    );
end;
$$;

comment on function public.stats_aggregate_totals(timestamptz, timestamptz) is
  'M4 pair expense/income totals for both members; aggregates only';

grant execute on function public.stats_aggregate_by_category(text, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.stats_aggregate_totals(timestamptz, timestamptz)
  to authenticated;

revoke all on function public.stats_aggregate_by_category(text, timestamptz, timestamptz)
  from public;
revoke all on function public.stats_aggregate_totals(timestamptz, timestamptz)
  from public;
