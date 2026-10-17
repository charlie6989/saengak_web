import { useState } from 'react';
import { Link } from 'react-router-dom';

const heroSlides = [
  { image: 'home-welcome', position: 'right center', label: 'LUCISSI CARE · BY LUCISSI', title: '貼近身體的日常照護。', description: 'LUCISSI 的日常照護系列：\n私密保養、舒適內搭，與生理期的每一天。', link: '/search', action: '開始選購', alt: '將隨身護理用品放入收納包的日常片刻' },
  { image: 'home-care', position: 'right center', label: 'INTIMATE CARE', title: '私密保養，從溫和開始', description: '清潔、舒緩與修護，為每天的私密日常，多一點安心。', link: '/search?category=私密保養', action: '認識私密保養', alt: 'Saengak 潔淨慕斯與修護噴霧的透光展示' },
  { image: 'home-wear', position: 'right center', label: 'EVERYDAY COMFORT', title: '貼身的，更要舒服', description: '從無痕、純棉到生理期內搭，每天都穿得自在。', link: '/search?category=舒適內搭', action: '探索舒適內搭', alt: '棉質內著自然垂放於柔軟座凳' },
];

export default function HeroSection() {
  const [currentSlide, setCurrentSlide] = useState(0);

  return (
    <section aria-label="LUCISSI CARE 日常照護主題" aria-roledescription="輪播" className="relative h-[650px] md:h-[640px] overflow-hidden bg-[#F7F6F3]">
      {heroSlides.map((slide, index) => (
        <div key={slide.image} aria-hidden={index !== currentSlide} inert={index !== currentSlide} className={`absolute inset-0 flex flex-col md:block ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0'}`}>
          <div className="h-[330px] shrink-0 md:h-full">
            <img src={`/images/lucissi-v5/${slide.image}.webp`} alt={slide.alt} width={1920} height={1080} fetchPriority={index === 0 ? 'high' : 'auto'} loading={index === 0 ? 'eager' : 'lazy'} className="h-full w-full object-cover md:object-contain" style={{ objectPosition: slide.position }} />
          </div>
          <div className="hidden md:block absolute inset-0 bg-linear-to-r/srgb from-[#F7F6F3] from-35% via-[#F7F6F3]/60 via-48% to-transparent to-65%" />
          <div className="relative px-7 pt-7 pb-16 md:absolute md:inset-0 md:flex md:items-center md:px-[8%] md:py-16">
            <div className="max-w-[540px]">
              <p className="text-xs tracking-[0.22em] text-brand mb-3">{slide.label}</p>
              <h1 className="text-[28px] md:text-5xl md:leading-none font-semibold leading-snug text-brand" style={{ textWrap: 'balance' }}>{slide.title}</h1>
              <p className="mt-3 md:mt-5 text-sm md:text-lg md:leading-7 leading-relaxed whitespace-pre-line text-[#5C5552]">{slide.description}</p>
              <Link to={slide.link} className="inline-flex mt-5 md:mt-7 border-b border-brand pb-1 text-sm font-medium text-brand">{slide.action}<span aria-hidden="true" className="ml-4">→</span></Link>
            </div>
          </div>
        </div>
      ))}
      <div className="absolute bottom-5 inset-x-0 z-20 flex items-center justify-center gap-4">
        <button onClick={() => setCurrentSlide(prev => (prev - 1 + heroSlides.length) % heroSlides.length)} aria-label="上一張品牌圖片" className="h-9 w-9 rounded-full bg-white/90 text-brand">←</button>
        {heroSlides.map((slide, index) => <button key={slide.image} onClick={() => setCurrentSlide(index)} aria-label={`顯示第 ${index + 1} 張品牌圖片`} aria-pressed={index === currentSlide} className="h-8 px-1"><span className={`block h-1.5 rounded-full bg-brand transition-all ${index === currentSlide ? 'w-7' : 'w-2 opacity-35'}`} /></button>)}
        <button onClick={() => setCurrentSlide(prev => (prev + 1) % heroSlides.length)} aria-label="下一張品牌圖片" className="h-9 w-9 rounded-full bg-white/90 text-brand">→</button>
      </div>
    </section>
  );
}
