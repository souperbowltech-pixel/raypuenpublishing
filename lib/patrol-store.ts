import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { supabase, isProduction } from '@/lib/supabase';
import { alertFailure } from '@/lib/alerts';
import { normalizeEmail } from '@/lib/family';

export interface ShippingAddress {
  recipient: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}

export interface PatrolLeader {
  id: string;
  email: string;
  token: string;
  stripeSessionId?: string;
  giftsRedeemedCount: number;
  status: 'in_progress' | 'completed' | 'claimed';
  createdAt: string;
  updatedAt: string;
}

export interface PatrolGift {
  code: string;
  patrolLeaderId: string;
  slotNumber: number;
  redeemedByFamilyId?: string;
  redeemedAt?: string;
  createdAt: string;
}

export interface GuideApproval {
  id: string;
  patrolLeaderId: string;
  approvalToken: string;
  recipientName: string;
  shippingAddress: ShippingAddress;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string;
  createdAt: string;
}

export interface PatrolLeaderDetails {
  leader: PatrolLeader;
  gifts: PatrolGift[];
  approval?: GuideApproval;
}

// ---------------------------------------------------------------------------
// Pure Helpers
// ---------------------------------------------------------------------------
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function newPatrolToken(): string {
  return `PT-${randomBytes(24).toString('base64url')}`;
}

export function newApprovalToken(): string {
  return `AP-${randomBytes(32).toString('base64url')}`;
}

export function generateGiftCodes(patrolToken: string): [string, string, string] {
  const bytes = randomBytes(6);
  let base = '';
  for (let i = 0; i < 6; i++) base += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return [`GP-${base}-1`, `GP-${base}-2`, `GP-${base}-3`];
}

// ---------------------------------------------------------------------------
// Local Memory / File Fallback (Development & Testing)
// ---------------------------------------------------------------------------
interface LocalPatrolStore {
  leaders: PatrolLeader[];
  gifts: PatrolGift[];
  approvals: GuideApproval[];
}

const LOCAL_FILE = path.join(process.cwd(), 'data', 'patrols.json');
const memory: LocalPatrolStore = { leaders: [], gifts: [], approvals: [] };

function readLocal(): LocalPatrolStore {
  try {
    if (fs.existsSync(LOCAL_FILE)) return JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8'));
  } catch {
    // fallback to memory
  }
  return memory;
}

function writeLocal(store: LocalPatrolStore) {
  Object.assign(memory, store);
  try {
    fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
    fs.writeFileSync(LOCAL_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch {
    // read-only filesystem
  }
}

// ---------------------------------------------------------------------------
// Core Patrol Functions
// ---------------------------------------------------------------------------

/**
 * Creates a new Patrol Leader and generates 3 gift codes.
 */
export async function createPatrolLeader(
  rawEmail: string,
  stripeSessionId?: string
): Promise<{ leader: PatrolLeader; giftCodes: string[]; token: string } | null> {
  const emailVal = normalizeEmail(rawEmail);
  const email = emailVal.ok ? emailVal.value : String(rawEmail).trim().toLowerCase();
  const token = newPatrolToken();
  const giftCodes = generateGiftCodes(token);
  const now = new Date().toISOString();

  if (!supabase) {
    if (isProduction) {
      void alertFailure('Patrol creation failed: database not configured on live site');
      return null;
    }
    const store = readLocal();
    const leader: PatrolLeader = {
      id: `local-leader-${Date.now()}`,
      email,
      token,
      stripeSessionId,
      giftsRedeemedCount: 0,
      status: 'in_progress',
      createdAt: now,
      updatedAt: now,
    };
    store.leaders.push(leader);

    const gifts: PatrolGift[] = giftCodes.map((code, idx) => ({
      code,
      patrolLeaderId: leader.id,
      slotNumber: idx + 1,
      createdAt: now,
    }));
    store.gifts.push(...gifts);
    writeLocal(store);
    return { leader, giftCodes, token };
  }

  const { data: leaderRow, error: leaderError } = await supabase
    .from('patrol_leaders')
    .insert({
      email,
      token,
      stripe_session_id: stripeSessionId,
      gifts_redeemed_count: 0,
      status: 'in_progress',
    })
    .select('*')
    .single();

  if (leaderError || !leaderRow) {
    void alertFailure('Patrol leader creation failed', { error: leaderError?.message });
    return null;
  }

  const giftRows = giftCodes.map((code, idx) => ({
    code,
    patrol_leader_id: leaderRow.id,
    slot_number: idx + 1,
  }));

  const { error: giftsError } = await supabase.from('patrol_gifts').insert(giftRows);
  if (giftsError) {
    void alertFailure('Patrol gifts creation failed', { error: giftsError.message });
  }

  const leader: PatrolLeader = {
    id: leaderRow.id,
    email: leaderRow.email,
    token: leaderRow.token,
    stripeSessionId: leaderRow.stripe_session_id,
    giftsRedeemedCount: Number(leaderRow.gifts_redeemed_count || 0),
    status: leaderRow.status,
    createdAt: leaderRow.created_at,
    updatedAt: leaderRow.updated_at,
  };

  return { leader, giftCodes, token };
}

/**
 * Retrieves a Patrol Leader along with their 3 gift codes and any guide claim status.
 */
export async function getPatrolLeaderByToken(token: string): Promise<PatrolLeaderDetails | null> {
  if (!token) return null;

  if (!supabase) {
    if (isProduction) return null;
    const store = readLocal();
    const leader = store.leaders.find((l) => l.token === token);
    if (!leader) return null;
    const gifts = store.gifts.filter((g) => g.patrolLeaderId === leader.id);
    const approval = store.approvals.find((a) => a.patrolLeaderId === leader.id);
    return { leader, gifts, approval };
  }

  const { data: leaderRow, error: leaderError } = await supabase
    .from('patrol_leaders')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (leaderError || !leaderRow) return null;

  const { data: giftRows } = await supabase
    .from('patrol_gifts')
    .select('*')
    .eq('patrol_leader_id', leaderRow.id)
    .order('slot_number', { ascending: true });

  const { data: approvalRow } = await supabase
    .from('guide_approvals')
    .select('*')
    .eq('patrol_leader_id', leaderRow.id)
    .maybeSingle();

  const leader: PatrolLeader = {
    id: leaderRow.id,
    email: leaderRow.email,
    token: leaderRow.token,
    stripeSessionId: leaderRow.stripe_session_id,
    giftsRedeemedCount: Number(leaderRow.gifts_redeemed_count || 0),
    status: leaderRow.status,
    createdAt: leaderRow.created_at,
    updatedAt: leaderRow.updated_at,
  };

  const gifts: PatrolGift[] = (giftRows || []).map((g: any) => ({
    code: g.code,
    patrolLeaderId: g.patrol_leader_id,
    slotNumber: Number(g.slot_number),
    redeemedByFamilyId: g.redeemed_by_family_id,
    redeemedAt: g.redeemed_at,
    createdAt: g.created_at,
  }));

  const approval: GuideApproval | undefined = approvalRow
    ? {
        id: approvalRow.id,
        patrolLeaderId: approvalRow.patrol_leader_id,
        approvalToken: approvalRow.approval_token,
        recipientName: approvalRow.recipient_name,
        shippingAddress: approvalRow.shipping_address,
        status: approvalRow.status,
        reviewedAt: approvalRow.reviewed_at,
        createdAt: approvalRow.created_at,
      }
    : undefined;

  return { leader, gifts, approval };
}

/**
 * Redeem a gift code when a gifted family registers.
 */
export async function redeemPatrolGift(
  code: string,
  familyId: string
): Promise<{ ok: boolean; message?: string }> {
  const cleanCode = String(code).trim().toUpperCase();
  const now = new Date().toISOString();

  if (!supabase) {
    const store = readLocal();
    const gift = store.gifts.find((g) => g.code === cleanCode);
    if (!gift) return { ok: false, message: 'Invalid gift code' };
    if (gift.redeemedByFamilyId) return { ok: false, message: 'Gift code already redeemed' };

    gift.redeemedByFamilyId = familyId;
    gift.redeemedAt = now;

    const leader = store.leaders.find((l) => l.id === gift.patrolLeaderId);
    if (leader) {
      const redeemedGifts = store.gifts.filter((g) => g.patrolLeaderId === leader.id && g.redeemedByFamilyId);
      leader.giftsRedeemedCount = Math.min(3, redeemedGifts.length);
      if (leader.giftsRedeemedCount >= 3 && leader.status === 'in_progress') {
        leader.status = 'completed';
      }
      leader.updatedAt = now;
    }
    writeLocal(store);
    return { ok: true };
  }

  const { data: giftRow, error: findError } = await supabase
    .from('patrol_gifts')
    .select('*, patrol_leaders(*)')
    .eq('code', cleanCode)
    .maybeSingle();

  if (findError || !giftRow) return { ok: false, message: 'Invalid gift code' };
  if (giftRow.redeemed_by_family_id) return { ok: false, message: 'Gift code already redeemed' };

  const { error: updateError } = await supabase
    .from('patrol_gifts')
    .update({ redeemed_by_family_id: familyId, redeemed_at: now })
    .eq('code', cleanCode);

  if (updateError) {
    void alertFailure('Gift code redemption failed', { error: updateError.message });
    return { ok: false, message: 'Could not redeem gift code' };
  }

  // Recount redeemed gifts for this leader
  const { count } = await supabase
    .from('patrol_gifts')
    .select('*', { count: 'exact', head: true })
    .eq('patrol_leader_id', giftRow.patrol_leader_id)
    .not('redeemed_by_family_id', 'is', null);

  const countNum = Math.min(3, count || 1);
  const newStatus = countNum >= 3 ? 'completed' : 'in_progress';

  await supabase
    .from('patrol_leaders')
    .update({ gifts_redeemed_count: countNum, status: newStatus, updated_at: now })
    .eq('id', giftRow.patrol_leader_id);

  return { ok: true };
}

/**
 * Submit shipping address for the Free Printed Parent's Guide reward.
 * Sets status to 'claimed' and creates a pending approval record for Ray.
 */
export async function submitGuideClaim(
  patrolToken: string,
  recipientName: string,
  shippingAddress: ShippingAddress
): Promise<{ ok: boolean; approvalToken?: string; error?: string }> {
  const details = await getPatrolLeaderByToken(patrolToken);
  if (!details) return { ok: false, error: 'Patrol leader not found' };
  if (details.leader.giftsRedeemedCount < 3) {
    return { ok: false, error: 'All 3 gift memberships must be registered before claiming the printed guide.' };
  }
  if (details.approval) {
    return { ok: true, approvalToken: details.approval.approvalToken };
  }

  const approvalToken = newApprovalToken();
  const now = new Date().toISOString();

  if (!supabase) {
    const store = readLocal();
    const leader = store.leaders.find((l) => l.id === details.leader.id);
    if (leader) {
      leader.status = 'claimed';
      leader.updatedAt = now;
    }
    const approval: GuideApproval = {
      id: `local-appr-${Date.now()}`,
      patrolLeaderId: details.leader.id,
      approvalToken,
      recipientName,
      shippingAddress,
      status: 'pending',
      createdAt: now,
    };
    store.approvals.push(approval);
    writeLocal(store);

    void alertFailure('New Free Parent Guide Claim Submitted (Pending Ray Approval)', {
      leaderEmail: details.leader.email,
      recipient: recipientName,
      approvalUrl: `https://puenpublishing.com/api/admin/approve-guide?token=${approvalToken}&action=approve`,
    });

    return { ok: true, approvalToken };
  }

  const { error: approvalError } = await supabase.from('guide_approvals').insert({
    patrol_leader_id: details.leader.id,
    approval_token: approvalToken,
    recipient_name: recipientName,
    shipping_address: shippingAddress,
    status: 'pending',
  });

  if (approvalError) {
    void alertFailure('Guide approval record insert failed', { error: approvalError.message });
    return { ok: false, error: 'Could not submit claim. Please try again.' };
  }

  await supabase
    .from('patrol_leaders')
    .update({ status: 'claimed', updated_at: now })
    .eq('id', details.leader.id);

  // Send failure/incident alert containing the 1-click approval URL
  void alertFailure('New Free Parent Guide Claim Submitted (Pending Ray Approval)', {
    leaderEmail: details.leader.email,
    recipient: recipientName,
    approvalUrl: `https://puenpublishing.com/api/admin/approve-guide?token=${approvalToken}&action=approve`,
  });

  return { ok: true, approvalToken };
}

/**
 * Ray's One-Click Approval / Rejection handler.
 */
export async function reviewGuideApproval(
  approvalToken: string,
  action: 'approve' | 'reject'
): Promise<{ ok: boolean; status?: 'approved' | 'rejected'; error?: string }> {
  const now = new Date().toISOString();
  const targetStatus = action === 'approve' ? 'approved' : 'rejected';

  if (!supabase) {
    const store = readLocal();
    const approval = store.approvals.find((a) => a.approvalToken === approvalToken);
    if (!approval) return { ok: false, error: 'Approval request not found or invalid token' };
    approval.status = targetStatus;
    approval.reviewedAt = now;
    writeLocal(store);
    return { ok: true, status: targetStatus };
  }

  const { data: approvalRow, error: findError } = await supabase
    .from('guide_approvals')
    .select('*')
    .eq('approval_token', approvalToken)
    .maybeSingle();

  if (findError || !approvalRow) {
    return { ok: false, error: 'Approval request not found or invalid token' };
  }

  const { error: updateError } = await supabase
    .from('guide_approvals')
    .update({ status: targetStatus, reviewed_at: now })
    .eq('approval_token', approvalToken);

  if (updateError) {
    void alertFailure('Review guide approval update failed', { error: updateError.message });
    return { ok: false, error: 'Could not update approval status' };
  }

  return { ok: true, status: targetStatus };
}
