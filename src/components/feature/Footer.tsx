import { Link } from 'react-router-dom';
import { siteContent } from '../../content/site';
import { ENDORSEMENT, LUCISSI_PUBLIC_URL } from '../../content/carePillars';

const footerLinkClass = 'text-base text-gray-600 transition-colors duration-200 hover:text-gray-900';
const footerHeadingClass = 'mb-5 text-sm font-bold tracking-wide text-gray-900';
const legalLinkClass = 'text-gray-500 transition-colors hover:text-gray-700';

const serviceLinks = [
  { to: '/customer-service', label: '客服中心' },
  { to: '/faq', label: '常見問題' },
  { to: '/order-status', label: '訂單查詢' },
  { to: '/return-policy', label: '退換貨說明' },
];

const brandLinks = [
  { to: '/about', label: '關於我們' },
  { to: '/community', label: 'LUCISSI Talk' },
  { to: '/promotion', label: '優惠活動' },
];

const legalLinks = [
  { to: '/terms', label: '條款和協議' },
  { to: '/adchoices', label: 'AdChoices' },
  { to: '/privacy', label: '隱私權' },
  { to: '/sitemap', label: '網站地圖' },
];

function FooterLinks({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h3 className={footerHeadingClass}>{title}</h3>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className={footerLinkClass}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 手機點按鈕直接開 LINE，桌機掃 QR code；QR 內容與 siteContent.lineAddFriendUrl 相同。 */
function FooterLineCard() {
  return (
    <section
      aria-labelledby="footer-line-heading"
      className="flex items-center gap-5 border border-gray-200 bg-white p-5"
    >
      <img
        src="/images/line-qr.svg"
        alt={`LINE 官方帳號 ${siteContent.lineOfficialId} 的加好友 QR code`}
        width={112}
        height={112}
        loading="lazy"
        className="h-24 w-24 shrink-0 sm:h-28 sm:w-28"
      />
      <div className="min-w-0">
        <h3 id="footer-line-heading" className="text-sm font-bold tracking-wide text-gray-900">
          LINE 官方帳號
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          商品、訂單與退換貨問題，都可以留言給我們。
        </p>
        <p className="mt-1 text-xs text-gray-500">ID：{siteContent.lineOfficialId}</p>
        <a
          href={siteContent.lineAddFriendUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand underline underline-offset-4"
        >
          <i className="ri-line-fill text-base" aria-hidden="true"></i>
          加入 LINE 好友
        </a>
      </div>
    </section>
  );
}

export default function Footer() {
  return (
    <footer className="border-t border-gray-200" style={{ backgroundColor: '#F7F6F3' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-32 md:pt-16 lg:pb-16">
        {/* pb-32：手機版底部導覽列固定在畫面下方，要留空間才點得到最後的法律連結 */}
        {/* 母品牌背書 */}
        <div className="mb-10 flex flex-col gap-4 border-b border-gray-200 pb-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-medium tracking-[0.18em] text-brand">BY LUCISSI</p>
            <p className="text-base leading-relaxed text-gray-600">
              {siteContent.brandName} 是 {ENDORSEMENT}，照顧貼近身體的每一天：私密保養、舒適內搭，與生理期照護。
            </p>
          </div>
          {LUCISSI_PUBLIC_URL && (
            <a
              href={LUCISSI_PUBLIC_URL}
              target="_blank"
              rel="noopener"
              className="inline-flex shrink-0 self-start border-b border-brand pb-1 text-sm font-medium text-brand md:self-auto"
            >
              前往 LUCISSI<span aria-hidden="true" className="ml-3">↗</span>
            </a>
          )}
        </div>

        {/* 主要內容區域 */}
        <div className="mb-10 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="grid grid-cols-2 gap-8 lg:col-span-7 lg:grid-cols-[1fr_1fr_1.6fr]">
            <FooterLinks title="客戶服務" links={serviceLinks} />
            <FooterLinks title="品牌" links={brandLinks} />
            <div className="col-span-2 lg:col-span-1">
              <h3 className={footerHeadingClass}>聯絡我們</h3>
              <a
                href={`mailto:${siteContent.companyEmail}`}
                className="flex items-center gap-1.5 text-sm text-gray-600 transition-colors hover:text-brand"
              >
                <i className="ri-mail-line text-lg" aria-hidden="true"></i>
                {siteContent.companyEmail}
              </a>
              <p className="mt-3 text-xs leading-relaxed text-gray-500">{siteContent.supportSafetyNotice}</p>
            </div>
          </div>
          <div className="lg:col-span-5">
            <FooterLineCard />
          </div>
        </div>

        {/* 公司資訊與法律連結 */}
        <div className="flex flex-col gap-6 border-t border-gray-200 pt-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5 text-sm text-gray-500">
            <p>© 2026 {siteContent.brandName}. All rights reserved.</p>
            <p>公司名稱：{siteContent.legalName}</p>
            <p>統一編號：{siteContent.taxId}</p>
            <p>登記地址：{siteContent.registeredAddress}</p>
          </div>
          <nav aria-label="法律資訊" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {legalLinks.map((link) => (
              <Link key={link.to} to={link.to} className={legalLinkClass}>{link.label}</Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
