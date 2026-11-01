-- Accepting a partner's code while you still hold a pending invite.
-- The Account card shows "your" code and also lets you type theirs.
-- Retire the caller's pending invite in the same transaction so the
-- open-link unique indexes allow the new pair. An active pair still rejects.
-- A bad code does not cancel the caller's invite (lookup happens first).

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

  -- Lock the caller's open rows before the target invite so a concurrent
  -- accept of this user's code cannot pair them twice.
  perform 1
  from public.partner_links pl
  where pl.status in ('pending', 'active')
    and (pl.user_a = v_uid or pl.user_b = v_uid)
  for update;

  if exists (
    select 1
    from public.partner_links pl
    where pl.status = 'active'
      and (pl.user_a = v_uid or pl.user_b = v_uid)
  ) then
    raise exception 'Already paired with a partner';
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

  -- Pending invites are user_a-only (user_b is null). End ours, keep theirs.
  update public.partner_links
  set
    status = 'ended',
    ended_at = now(),
    invite_code = null
  where public.partner_links.status = 'pending'
    and public.partner_links.user_a = v_uid
    and public.partner_links.id <> v_row.id;

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
  'Redeem invite code → active pair. Ends the caller''s own pending invite in the same transaction. Rejects an active pair or your own code.';
