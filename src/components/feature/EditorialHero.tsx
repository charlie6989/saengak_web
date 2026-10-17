import type { ReactNode } from 'react';

/** Shared full-bleed banner. Mobile copy stays below the image so subjects remain unobstructed. */
export default function EditorialHero({ image, alt, eyebrow, title, description, children, className = '', preserveImage = true, headingLevel = 'h1', compact = false, priority = true }: {
  image: string; alt: string; eyebrow: string; title: ReactNode; description: string; children?: ReactNode; className?: string; preserveImage?: boolean; headingLevel?: 'h1' | 'h2';
  /** 分類／列表頁用的窄版橫幅，讓商品更早出現在首屏 */
  compact?: boolean;
  /** 只有首屏主視覺需要高載入優先權；頁面下方的橫幅改為延遲載入 */
  priority?: boolean;
}) {
  const Heading = headingLevel;
  return (
    <section data-editorial-hero className={`relative overflow-hidden bg-[#F7F6F3] ${compact ? 'md:min-h-[220px]' : 'md:min-h-[460px]'} ${className}`}>
      <img src={image} alt={alt} width={1920} height={1080} fetchPriority={priority ? 'high' : 'auto'} loading={priority ? 'eager' : 'lazy'} className={`${compact ? 'hidden md:block' : 'h-[240px]'} w-full object-cover object-right md:absolute md:inset-0 md:h-full ${preserveImage ? 'md:object-contain' : ''}`} />
      <div className={`pointer-events-none absolute inset-0 hidden bg-linear-to-r/srgb md:block ${preserveImage ? 'from-[#F7F6F3] from-40% via-[#F7F6F3]/70 via-52% to-transparent to-68%' : 'from-[#F7F6F3]/95 via-[#F7F6F3]/75 to-transparent'}`} />
      <div className={`relative mx-auto max-w-7xl px-6 md:flex md:items-center md:px-12 ${compact ? 'py-6 md:min-h-[220px] md:py-8' : 'py-10 md:min-h-[460px] md:py-16'}`}>
        <div className="max-w-xl md:w-[52%]">
          <p className="mb-4 text-xs font-medium tracking-[0.18em] text-brand">{eyebrow}</p>
          <Heading className={`font-semibold leading-snug text-brand ${compact ? 'mb-2 text-2xl md:text-4xl md:leading-10' : 'mb-5 text-3xl md:text-5xl md:leading-none'}`} style={{ textWrap: 'balance' }}>{title}</Heading>
          <p className={`leading-relaxed text-gray-500 ${compact ? 'text-sm md:text-base md:leading-6' : 'text-base md:text-lg md:leading-7'}`} style={{ textWrap: 'pretty' }}>{description}</p>
          {children}
        </div>
      </div>
    </section>
  );
}
