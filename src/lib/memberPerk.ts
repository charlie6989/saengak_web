import { supabase } from './supabase';

/** LUCISSI 會員首單免運（會員互通第 1 階段）。正式環境設定完成前以旗標隱藏。 */
export const LUCISSI_MEMBER_PERK_ENABLED = import.meta.env.VITE_PUBLIC_LUCISSI_MEMBER_PERK_ENABLED === 'true';

export interface MemberPerk {
  coupon_code: string;
  status: 'issued' | 'used';
  claimed_at?: string;
}

export interface MemberPerkResult {
  success: boolean;
  perk?: MemberPerk;
  code?: string;
  message?: string;
}

/** 讀取自己已領取的代碼（RLS 只回傳本人的那筆）。 */
export async function fetchMyMemberPerk(): Promise<MemberPerk | null> {
  const { data, error } = await supabase
    .from('partner_member_perks')
    .select('coupon_code, status, claimed_at')
    .maybeSingle();
  if (error) return null;
  return (data as MemberPerk | null) ?? null;
}

export async function claimLucissiMemberPerk(): Promise<MemberPerkResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { success: false, code: 'MEMBER_LOGIN_REQUIRED', message: '請先登入會員' };

  try {
    const response = await fetch('/api/promotions/lucissi-member-perk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    const body = await response.json().catch(() => ({})) as MemberPerkResult;
    return { ...body, success: Boolean(body.success) };
  } catch {
    return { success: false, code: 'NETWORK_ERROR', message: '連線失敗，請稍後再試' };
  }
}
