import { describe, expect, it } from 'vitest';
import { safePublicHttpsUrl } from './publicUrl';

describe('safePublicHttpsUrl', () => {
  it('accepts public HTTPS links', () => {
    expect(safePublicHttpsUrl('https://tracking.example.com/order/1')).toBe('https://tracking.example.com/order/1');
  });

  it('rejects local, credentialed and non-HTTPS links', () => {
    expect(safePublicHttpsUrl('https://127.0.0.1/order/1')).toBeNull();
    expect(safePublicHttpsUrl('https://user:pass@example.com/order/1')).toBeNull();
    expect(safePublicHttpsUrl('http://tracking.example.com/order/1')).toBeNull();
  });
});
