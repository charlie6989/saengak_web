import type { ReactNode } from 'react';

/** Shared full-bleed banner. Mobile copy stays below the image so subjects remain unobstructed. */
export default function EditorialHero({ image, alt, eyebrow, title, description, children, className = '', preserveImage = true, headingLevel = 'h1' }: {
  image: string; alt: string; eyebrow: string; title: string; description: string; children?: ReactNode; className?: string; preserveImage?: boolean; headingLevel?: 'h1' | 'h2';
}) {
  const Heading = headingLevel;
  return (
    <section data-editorial-hero className={`relative overflow-hidden bg-[#F8F5F1] md:min-h-[460px] ${className}`}>
      <img src={image} alt={alt} width={1920} height={1080} fetchPriority="high" className={`h-[240px] w-full object-cover object-right md:absolute md:inset-0 md:h-full ${preserveImage ? 'md:object-contain' : ''}`} />
      <div className={`pointer-events-none absolute inset-0 hidden bg-gradient-to-r md:block ${preserveImage ? 'from-[#F8F5F1] from-[40%] via-[#F8F5F1]/70 via-[52%] to-transparent to-[68%]' : 'from-[#F8F5F1]/95 via-[#F8F5F1]/75 to-transparent'}`} />
      <div className="relative mx-auto max-w-7xl px-6 py-10 md:flex md:min-h-[460px] md:items-center md:px-12 md:py-16">
        <div className="max-w-xl md:w-[52%]">
          <p className="mb-4 text-xs font-medium tracking-[0.18em] text-[#5B3D48]">{eyebrow}</p>
          <Heading className="mb-5 text-3xl font-semibold leading-snug text-[#5B3D48] md:text-5xl" style={{ textWrap: 'balance' }}>{title}</Heading>
          <p className="text-base leading-relaxed text-[#655859] md:text-lg" style={{ textWrap: 'pretty' }}>{description}</p>
          {children}
        </div>
      </div>
    </section>
  );
}
