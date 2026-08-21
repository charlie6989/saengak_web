import { describe, it, expect } from 'vitest';
import { siteContent } from '../src/content/site';

describe('Site Content & Brand Alignment', () => {
  it('should maintain the reviewed legal and support information', () => {
    expect(siteContent.brandName).toBe('SAENGAK');
    expect(siteContent.legalName).toBe('拜悠衣品有限公司');
    expect(siteContent.taxId).toBe('90014835');
    expect(siteContent.companyEmail).toBe('Company@lucissi.com');
    expect(siteContent.registeredAddress).toBe('新北市汐止區長興街1段14號');
    expect(siteContent.supportStatus).toBe('正式客服電話、電子郵件與官方 LINE 尚待營運確認');
    expect(siteContent.supportSafetyNotice).toContain('請勿透過非官方帳號提供訂單個資');
  });
});
