import { Link } from 'react-router-dom';
import EditorialHero from '../../../components/feature/EditorialHero';
import { LUCISSI_URL } from '../../../content/carePillars';

/** 說明與母品牌 LUCISSI 的關係。會員權益是否與 LUCISSI 互通尚未確認，文案不承諾共用會員。 */
export default function FromLucissiSection() {
  return (
    <EditorialHero
      image="/images/lucissi-v5/about-hero.webp"
      alt="選品工作桌前，仔細閱讀護理產品包裝的女性"
      eyebrow="FROM LUCISSI"
      headingLevel="h2"
      priority={false}
      title={<>LUCISSI 的<br />日常照護系列</>}
      description="LUCISSI CARE 由 LUCISSI 團隊挑選，專注在身體的照顧與每天的舒適。在 LUCISSI 買過東西的妳，在這裡也能找到日常需要的那一份安心。"
    >
      <div className="mt-7 flex flex-wrap items-center gap-6">
        <Link to="/login" className="bg-brand px-6 py-3 text-sm font-semibold text-white">登入領取會員優惠</Link>
        <a href={LUCISSI_URL} target="_blank" rel="noopener" className="inline-flex border-b border-brand pb-1 text-sm font-medium text-brand">
          前往 LUCISSI<span aria-hidden="true" className="ml-3">↗</span>
        </a>
      </div>
    </EditorialHero>
  );
}
