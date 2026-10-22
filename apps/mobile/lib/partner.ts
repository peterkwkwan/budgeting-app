import { supabase } from './supabase';

export type PartnerLinkStatus = 'pending' | 'active' | 'ended';

export type PartnerLink = {
  id: string;
  status: 'pending' | 'active';
  inviteCode: string | null;
  isCreator: boolean;
  partnerId: string | null;
  partnerDisplayName: string | null;
  createdAt: string;
  linkedAt: string | null;
};

function mapLinkRow(row: Record<string, unknown>): PartnerLink {
  const status = String(row.status) as 'pending' | 'active';
  return {
    id: String(row.id),
    status,
    inviteCode: row.invite_code != null ? String(row.invite_code) : null,
    isCreator: Boolean(row.is_creator),
    partnerId: row.partner_id != null ? String(row.partner_id) : null,
    partnerDisplayName:
      row.partner_display_name != null
        ? String(row.partner_display_name)
        : null,
    createdAt: String(row.created_at),
    linkedAt: row.linked_at != null ? String(row.linked_at) : null,
  };
}

/** Current pending or active link for the signed-in user, or null. */
export async function fetchPartnerLink(): Promise<PartnerLink | null> {
  const { data, error } = await supabase.rpc('partner_get_link');

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return null;
  return mapLinkRow(rows[0]!);
}

/** Create or refresh a pending invite code. */
export async function createPartnerInvite(): Promise<PartnerLink> {
  const { data, error } = await supabase.rpc('partner_create_invite');

  if (error) {
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    throw new Error('No invite returned');
  }

  return {
    id: String(row.id),
    status: 'pending',
    inviteCode: row.invite_code != null ? String(row.invite_code) : null,
    isCreator: true,
    partnerId: null,
    partnerDisplayName: null,
    createdAt: String(row.created_at),
    linkedAt: null,
  };
}

/** Redeem an invite code → active pair. */
export async function acceptPartnerInvite(code: string): Promise<PartnerLink> {
  const { data, error } = await supabase.rpc('partner_accept_invite', {
    p_code: code.trim().toUpperCase(),
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    throw new Error('Accept failed');
  }

  return {
    id: String(row.id),
    status: 'active',
    inviteCode: null,
    isCreator: false,
    partnerId: row.partner_id != null ? String(row.partner_id) : null,
    partnerDisplayName:
      row.partner_display_name != null
        ? String(row.partner_display_name)
        : 'Partner',
    createdAt: '',
    linkedAt: row.linked_at != null ? String(row.linked_at) : null,
  };
}

/** End pending or active link. Aggregate UI must hide immediately. */
export async function unlinkPartner(): Promise<void> {
  const { error } = await supabase.rpc('partner_unlink');
  if (error) {
    throw new Error(error.message);
  }
}

export const partnerKeys = {
  all: ['partner'] as const,
  link: () => [...partnerKeys.all, 'link'] as const,
};
