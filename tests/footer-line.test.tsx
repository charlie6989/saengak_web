import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Footer from '../src/components/feature/Footer';
import { siteContent } from '../src/content/site';

describe('footer LINE contact', () => {
  const html = renderToStaticMarkup(<MemoryRouter><Footer /></MemoryRouter>);

  it('links to the official account and shows its QR code', () => {
    expect(html).toContain(`href="${siteContent.lineAddFriendUrl}"`);
    expect(html).toContain('src="/images/line-qr.svg"');
    expect(html).toContain(siteContent.lineOfficialId);
  });

  it('keeps the seller identity and legal links', () => {
    for (const text of [siteContent.legalName, siteContent.taxId, siteContent.registeredAddress, siteContent.companyEmail]) {
      expect(html).toContain(text);
    }
    for (const path of ['/terms', '/privacy', '/return-policy', '/faq', '/order-status']) {
      expect(html).toContain(`href="${path}"`);
    }
  });

  it('no longer points anywhere at the dead @saengak account', () => {
    for (const file of ['src/pages/product/page.tsx', 'src/pages/promotion/page.tsx', 'src/pages/admin/SiteSettings.tsx']) {
      expect(readFileSync(file, 'utf8')).not.toContain('ti/p/@saengak');
    }
  });
});
