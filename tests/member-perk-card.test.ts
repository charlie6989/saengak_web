import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({ supabase: {} }));

import { visibleMemberPerk } from '../src/lib/memberPerk';

describe('LUCISSI member perk card ownership', () => {
  const state = { ownerId: 'member-a', perk: { coupon_code: 'LCABCDEFGHJ9', status: 'issued' as const } };

  it('shows the code only to the member it was loaded for', () => {
    expect(visibleMemberPerk(state, 'member-a')?.coupon_code).toBe('LCABCDEFGHJ9');
  });

  it('hides the code after sign-out or when another member signs in', () => {
    expect(visibleMemberPerk(state, null)).toBeNull();
    expect(visibleMemberPerk(state, undefined)).toBeNull();
    expect(visibleMemberPerk(state, 'member-b')).toBeNull();
    expect(visibleMemberPerk(null, 'member-a')).toBeNull();
  });
});
