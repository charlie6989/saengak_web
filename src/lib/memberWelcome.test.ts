import { describe, expect, it } from 'vitest';
import { isFirstSignIn } from './memberWelcome';

describe('first sign-in detection', () => {
  it('treats a new Google account as a first sign-in', () => {
    expect(isFirstSignIn({ created_at: '2026-10-18T05:00:00Z', email_confirmed_at: '2026-10-18T05:00:00Z', last_sign_in_at: '2026-10-18T05:00:02Z' })).toBe(true);
  });

  it('treats confirming the sign-up email hours later as a first sign-in', () => {
    expect(isFirstSignIn({ created_at: '2026-10-17T22:00:00Z', email_confirmed_at: '2026-10-18T05:00:00Z', last_sign_in_at: '2026-10-18T05:00:01Z' })).toBe(true);
  });

  it('treats a returning member as not new', () => {
    expect(isFirstSignIn({ created_at: '2026-08-30T13:00:00Z', email_confirmed_at: '2026-08-30T13:05:00Z', last_sign_in_at: '2026-10-18T07:00:00Z' })).toBe(false);
  });

  it('defaults to the first-sign-in greeting when times are missing', () => {
    expect(isFirstSignIn(null)).toBe(true);
    expect(isFirstSignIn({ created_at: '2026-08-30T13:00:00Z' })).toBe(true);
  });
});
