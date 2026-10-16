import { BRAND_LOGO_LOCKUPS, type BrandLogoLockup } from './brandLogoPaths';

/**
 * LUCISSI CARE 字標（方向 A：家族字標）。以外框路徑輸出，不依賴使用者裝置字型；顏色跟隨 currentColor（預設 text-brand）。
 * small：120–199px（網站 header）；primary：≥ 200px；horizontal：單行、寬度 ≥ 130px。
 */
export default function BrandLogo({ lockup = 'small', className = '' }: { lockup?: BrandLogoLockup; className?: string }) {
  const { viewBox, d } = BRAND_LOGO_LOCKUPS[lockup];
  return (
    <svg
      role="img"
      aria-label="LUCISSI CARE"
      viewBox={viewBox}
      fill="currentColor"
      className={`block h-auto shrink-0 text-brand ${className}`}
    >
      <path d={d} />
    </svg>
  );
}
