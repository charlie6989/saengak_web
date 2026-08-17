import { describe, it, expect } from 'vitest';
import { siteConfig } from '../src/content/site';

describe('Site Content & Brand Alignment', () => {
  it('should maintain authoritative brand information in siteConfig', () => {
    expect(siteConfig.brandName).toBe('SAENGAK');
    expect(siteConfig.companyName).toBe('拜悠衣品有限公司');
    expect(siteConfig.taxId).toBe('90014835');
    expect(siteConfig.supportEmail).toBe('support@saengak.com.tw');
    expect(siteConfig.servicePhone).toBe('02-7700-0000');
    expect(siteConfig.serviceHours).toBe('週一至週五 9:30~18:00 (國定例假日除外)');
    expect(siteConfig.companyAddress).toBe('台北市信義區忠孝東路五段68號');
    expect(siteConfig.siteUrl).toBe('https://saengak.com.tw');
  });
});
