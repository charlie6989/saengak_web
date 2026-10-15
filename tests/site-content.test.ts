import { describe, it, expect } from 'vitest';
import { siteContent } from '../src/content/site';

describe('Site Content & Brand Alignment', () => {
  it('should maintain the reviewed legal and support information', () => {
    expect(siteContent.brandName).toBe('LUCISSI CARE');
    expect(siteContent.legalName).toBe('拜悠衣品有限公司');
    expect(siteContent.taxId).toBe('90014835');
    expect(siteContent.companyEmail).toBe('Company@lucissi.com');
    expect(siteContent.registeredAddress).toBe('新北市汐止區長興街1段14號');
    expect(siteContent.supportContact).toContain(siteContent.companyEmail);
    expect(siteContent.supportSafetyNotice).toContain('請勿向任何人提供信用卡卡號');
  });
});
